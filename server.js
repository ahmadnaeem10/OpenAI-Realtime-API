import http from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { WebSocket as NodeWebSocket } from 'ws';
import dotenv from 'dotenv';
import multer from 'multer';

dotenv.config();
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const upload = multer({ dest: 'uploads/' });

// Serve the homepage
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Function to analyze the transcript for religious content
function analyzeContent(transcript) {
  const keywords = ['God', 'religion', 'spiritual', 'faith', 'church', 'temple', 'mosque', 'prayer'];
  const isRelatedToReligion = keywords.some(keyword => transcript.toLowerCase().includes(keyword.toLowerCase()));

  if (isRelatedToReligion) {
    return `Religious content detected: ${transcript}`;
  } else {
    return "I can't answer on this.";
  }
}

// Endpoint for processing audio and returning results based on content
app.post('/process-audio', upload.single('audioFile'), (req, res) => {
  const filePath = req.file.path;
  const targetPath = __dirname + '/uploads/' + req.file.originalname;

  // Convert and process the audio file
  ffmpeg(filePath)
    .outputOptions(['-f s16le', '-acodec pcm_s16le', '-ac 1', '-ar 16000'])
    .save(targetPath)
    .on('end', () => {
      fs.readFile(targetPath, (err, audioData) => {
        if (err) {
          console.error('Error reading audio file:', err);
          res.status(500).send({ error: 'Error reading processed audio file.' });
          return;
        }
        
        // Process audio with WebSocket
        connectAndSendAudio(audioData, null, (transcript) => {
          // Analyze and return the result based on content
          const response = analyzeContent(transcript);
          res.send({ message: 'Audio processed successfully.', result: response });
          
          // Clean up files
          fs.unlinkSync(filePath);
          fs.unlinkSync(targetPath);
        });
      });
    })
    .on('error', (err) => {
      console.error('Error converting audio:', err);
      res.status(500).send({ error: 'Error processing file.' });
    });
});

// WebSocket connection handling for real-time audio transcription
io.on('connection', (socket) => {
  socket.on('audio-upload', (data) => {
    const filePath = __dirname + '/uploads/audioFile.wav';
    fs.writeFileSync(filePath, Buffer.from(new Uint8Array(data)));

    // Convert audio file to the appropriate format
    ffmpeg(filePath)
      .outputOptions(['-f s16le', '-acodec pcm_s16le', '-ac 1', '-ar 16000'])
      .on('error', (err) => {
        console.error('Error converting audio:', err);
        socket.emit('transcript', 'Error converting audio.');
      })
      .on('end', () => {
        fs.readFile(__dirname + '/converted_audio.pcm', (err, audioData) => {
          if (err) {
            console.error('Error reading converted audio file:', err);
            return;
          }
          connectAndSendAudio(audioData, socket);
          fs.unlinkSync(filePath);
          fs.unlinkSync(__dirname + '/converted_audio.pcm');
        });
      })
      .save(__dirname + '/converted_audio.pcm');
  });
});

// Function to connect to OpenAI WebSocket and send audio data
function connectAndSendAudio(audioData, socket = null, callback = null) {
  const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';
  const ws = new NodeWebSocket(url, {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  });

  ws.on('open', function open() {
    ws.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: audioData.toString('base64'),
    }));

    ws.send(JSON.stringify({
      type: 'input_audio_buffer.commit',
    }));
  });

  ws.on('message', function incoming(message) {
    const data = JSON.parse(message);
    if (data.type === 'response.audio_transcript.done') {
      const transcript = data.transcript || "No transcript received.";
      const response = analyzeContent(transcript);

      // Send response to socket if available, or use callback
      if (socket) {
        socket.emit('transcript', response);
      }
      if (callback) {
        callback(response);
      }
    }
  });

  ws.on('error', function error(err) {
    console.error('WebSocket Error:', err);
    if (socket) {
      socket.emit('transcript', 'WebSocket error occurred.');
    }
    if (callback) {
      callback('WebSocket error occurred.');
    }
  });
}

// Start the server
server.listen(3000, () => {
  console.log('Server listening on http://localhost:3000');
});
