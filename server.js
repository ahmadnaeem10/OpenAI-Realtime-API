import http from 'http';
import express from 'express';
import { Server as SocketIOServer } from 'socket.io';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { WebSocket as NodeWebSocket } from 'ws';
import dotenv from 'dotenv';
import multer from 'multer';

dotenv.config();
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: '*' } });
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure multer for temporary uploads
const upload = multer({ dest: 'uploads/' });

// Serve the homepage
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

// Function to provide divine answers from holy scriptures
function generateDivineAnswer() {
  const holyResponses = [
    "'Indeed, Allah is with those who are patient.'",
    "'Indeed, with hardship [will be] ease.'",
    "'Say, “He is Allah, [Who is] One. Allah, the Eternal Refuge.”'",
    "'And He is the Forgiving, the Merciful.'"
  ];

  // Choose a random holy scripture response
  const randomResponse = holyResponses[Math.floor(Math.random() * holyResponses.length)];
  return randomResponse;
}

// Function to generate a personal response
function generatePersonalResponse(transcript) {
  if (/love you/i.test(transcript)) {
    return `Thank you for your kind words. While I'm just a program and can't express feelings, it's good to hear positivity and love! How can I assist you further?`;
  }
  return `It sounds like you said: "${transcript}". It's nice to hear such kind words! How can I assist you further?`;
}

// Function to generate a response to general greetings and questions
function generateGeneralResponse(transcript) {
  if (/^hi$|^hello$|^hey$/i.test(transcript)) {
    return "Hello! How can I assist you today?";
  } else if (/how are you/i.test(transcript)) {
    return "I'm just a program, so I don't have feelings, but thanks for asking! How can I help you today?";
  } else if (/what.*your age/i.test(transcript)) {
    return "I exist outside of time, so age doesn't apply to me. How can I assist you with your queries today?";
  } else {
    return `"${transcript}". How can I assist you further?`;
  }
}

// Function to generate a normal response for non-religious content
function generateNormalResponse(transcript) {
  return generateGeneralResponse(transcript);
}

// Function to check for abusive or vulgar content
function containsAbusiveContent(transcript) {
  const abusivePatterns = [
    /abuse/i,
    /vulgar/i,
    /offensive/i,
    /curse/i,
    /swear/i,
    /fuck/i,
    /shit/i,
    /damn/i,
    /bitch/i,
    /asshole/i
  ];

  return abusivePatterns.some(pattern => pattern.test(transcript));
}

// Function to analyze the transcript for content
function analyzeContent(transcript) {
  // Check for abusive content
  if (containsAbusiveContent(transcript)) {
    return "I can't respond to vulgarity and abusive words.";
  }

  // Use a case-insensitive regular expression to match religious content
  const religiousPatterns = [
    /quran/i,
    /bible/i,
    /verse/i,
    /ayat/i,
    /merciful/i,
    /god/i,
    /allah/i,
    /spiritual/i,
    /holy/i,
    /scripture/i,
    /prayer/i
  ];

  // Check if the transcript matches any of the religious patterns
  const isReligious = religiousPatterns.some(pattern => pattern.test(transcript));

  // If a match is found, return a divine answer; if not, check for personal or casual content
  if (isReligious) {
    return generateDivineAnswer();
  } else if (/papa|mom|dad|love|family|friend/i.test(transcript)) {
    return generatePersonalResponse(transcript);
  } else {
    return generateNormalResponse(transcript);
  }
}

// Endpoint for processing audio and returning results based on content
app.post('/process-audio', upload.single('audioFile'), (req, res) => {
  const filePath = req.file.path;
  const targetPath = join(__dirname, 'uploads', `${Date.now()}-${req.file.originalname}`);

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
          if (!transcript) { // Handle the case where no transcript is received
            res.send({ message: 'Voice quality is poor. Kindly upload again.' });
          } else {
            const response = analyzeContent(transcript);
            res.send({ message: 'Audio processed successfully.', result: response });
          }

          // Clean up files
          fs.unlinkSync(filePath);
          fs.unlinkSync(targetPath);
        });
      });
    })
    .on('error', (err) => {
      console.error('Error converting audio:', err);
      res.status(500).send({ error: 'Voice quality is poor. Kindly upload again.' });
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
      const transcript = data.transcript || null; // Handle potential null responses
      
      if (callback) {
        callback(transcript);
      }
    }
  });

  ws.on('error', function error(err) {
    console.error('WebSocket Error:', err);
    if (callback) {
      callback(null); // Assume poor audio quality on WebSocket error
    }
  });
}

// Use the environment variable PORT or fallback to 3000 for local development
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
