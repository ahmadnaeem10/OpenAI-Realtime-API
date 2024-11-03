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
function generateDivineAnswer(transcript) {
  // Simulating a divine response that quotes from holy scriptures
  const holyResponses = [
    "From the Bible: 'For I know the plans I have for you,' declares the Lord, 'plans to prosper you and not to harm you, plans to give you hope and a future.' - Jeremiah 29:11",
    "From the Quran: 'Indeed, with hardship [will be] ease.' - Surah Ash-Sharh 94:6",
    "From the Torah: 'The Lord bless you and keep you; The Lord make His face shine upon you, And be gracious to you.' - Numbers 6:24-25",
    "From the Bhagavad Gita: 'You have the right to work, but never to the fruit of work. You should never engage in action for the sake of reward, nor should you long for inaction.' - Chapter 2, Verse 47",
    "From Buddhist Teachings: 'Peace comes from within. Do not seek it without.' - Buddha",
    // Add more quotes from other religious texts as needed
  ];

  // Choose a random holy scripture response
  const randomResponse = holyResponses[Math.floor(Math.random() * holyResponses.length)];
  return `Divine Response: ${randomResponse}`;
}

// Function to analyze the transcript for religious content
function analyzeContent(transcript) {
  // Expanded list of keywords and phrases to improve detection
  const keywords = [
    'God', 'religion', 'spiritual', 'faith', 'church', 'temple', 'mosque', 
    'prayer', 'Quran', 'Bible', 'verse', 'scripture', 'holy', 'merciful', 'mercifulness'
  ];

  const religiousPhrases = [
    'Can you tell me a Quranic verse', 
    'Tell me a verse from the Bible', 
    'Recite something from the holy book', 
    'Give me a scripture about', 
    'I want to hear a quote from'
  ];

  // Check for any keyword matches
  const isKeywordMatch = keywords.some(keyword => transcript.toLowerCase().includes(keyword.toLowerCase()));

  // Check for any religious phrase matches
  const isPhraseMatch = religiousPhrases.some(phrase => transcript.toLowerCase().includes(phrase.toLowerCase()));

  // If either matches, respond with a divine answer
  if (isKeywordMatch || isPhraseMatch) {
    return generateDivineAnswer(transcript);
  } else {
    return "I can't answer on this topic as it is not related to religion.";
  }
}

// Endpoint for processing audio and returning results based on content
app.post('/process-audio', upload.single('audioFile'), (req, res) => {
  const filePath = req.file.path;
  const targetPath = join(__dirname, 'uploads', req.file.originalname);

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

      // Send response via callback
      if (callback) {
        callback(response);
      }
    }
  });

  ws.on('error', function error(err) {
    console.error('WebSocket Error:', err);
    if (callback) {
      callback('WebSocket error occurred.');
    }
  });
}

// Use the environment variable PORT or fallback to 3000 for local development
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
