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
import { tmpdir } from 'os';
import path from 'path';

dotenv.config();
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: '*' } });
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure multer to use system temp directory
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = tmpdir();
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage: storage });

// Serve the homepage
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'index.html'));
});

// Comprehensive religious content database with focus on mercy
const religiousContent = {
  islam: {
    keywords: ['allah', 'quran', 'islamic', 'muslim', 'mohammad', 'mosque', 'namaz', 'salah', 'ramadan', 'eid', 'merciful', 'mercy', 'rahman', 'rahim', 'ayat', 'verse', 'surah'],
    mercyVerses: [
      {
        text: "Your Lord has decreed upon Himself mercy: that any of you who does wrong out of ignorance and then repents after that and corrects himself - indeed, He is Forgiving and Merciful.",
        source: "Surah Al-An'am 6:54"
      },
      {
        text: "And My mercy embraces all things.",
        source: "Surah Al-A'raf 7:156"
      },
      {
        text: "In the name of Allah, the Most Beneficent, the Most Merciful.",
        source: "Bismillah Ar-Rahman Ar-Raheem"
      },
      {
        text: "And We have not sent you, [O Muhammad], except as a mercy to the worlds.",
        source: "Surah Al-Anbya 21:107"
      },
      {
        text: "Say, [O Muhammad], 'O My servants who have transgressed against themselves [by sinning], do not despair of the mercy of Allah. Indeed, Allah forgives all sins. Indeed, it is He who is the Forgiving, the Merciful.'",
        source: "Surah Az-Zumar 39:53"
      }
    ],
    generalVerses: [
      {
        text: "Indeed, with hardship [will be] ease.",
        source: "Surah Ash-Sharh 94:6"
      },
      {
        text: "And when My servants ask you concerning Me - indeed I am near.",
        source: "Surah Al-Baqarah 2:186"
      }
    ]
  },
  // ... [other religions' content remains the same]
};

// Function to analyze content and provide appropriate religious response
function analyzeContent(transcript) {
  console.log('Analyzing transcript:', transcript); // Debug log
  const lowercaseTranscript = transcript.toLowerCase();
  
  // Special handling for mercy-related Quranic verses
  const mercyKeywords = ['mercy', 'merciful', 'rahman', 'rahim', 'forgiveness', 'forgive'];
  const isAskingForMercy = mercyKeywords.some(keyword => 
    lowercaseTranscript.includes(keyword.toLowerCase())
  );

  const islamicKeywords = religiousContent.islam.keywords;
  const isIslamicQuery = islamicKeywords.some(keyword => 
    lowercaseTranscript.includes(keyword.toLowerCase())
  );

  if (isIslamicQuery) {
    if (isAskingForMercy) {
      // Select a random mercy verse
      const mercyVerse = religiousContent.islam.mercyVerses[
        Math.floor(Math.random() * religiousContent.islam.mercyVerses.length)
      ];
      return {
        type: 'religious',
        religion: 'islam',
        subtype: 'mercy',
        response: `Here's a Quranic verse about mercy: "${mercyVerse.text}" - ${mercyVerse.source}`
      };
    } else {
      // Select a random general Islamic verse
      const generalVerse = religiousContent.islam.generalVerses[
        Math.floor(Math.random() * religiousContent.islam.generalVerses.length)
      ];
      return {
        type: 'religious',
        religion: 'islam',
        subtype: 'general',
        response: `From the Quran: "${generalVerse.text}" - ${generalVerse.source}`
      };
    }
  }

  // Check for general religious terms
  const generalReligiousTerms = ['god', 'prayer', 'faith', 'spiritual', 'divine', 'holy', 'sacred', 'blessing'];
  const isGeneralReligious = generalReligiousTerms.some(term => 
    lowercaseTranscript.includes(term.toLowerCase())
  );

  if (isGeneralReligious) {
    return {
      type: 'religious',
      religion: 'general',
      response: "All paths lead to the divine. Each religion offers wisdom and guidance to those who seek it."
    };
  }

  // If no religious content is detected
  return {
    type: 'non_religious',
    response: "I can't answer on this topic as it is not related to religion."
  };
}

// Endpoint for processing audio and returning results based on content
app.post('/process-audio', upload.single('audioFile'), async (req, res) => {
  console.log('Audio processing request received'); // Debug log
  
  if (!req.file) {
    console.log('No file uploaded'); // Debug log
    return res.status(400).send({ error: 'No audio file provided.' });
  }

  try {
    const filePath = req.file.path;
    const tempOutputPath = path.join(tmpdir(), `processed-${Date.now()}.wav`);
    console.log('Processing file:', filePath); // Debug log

    // Convert and process the audio file
    await new Promise((resolve, reject) => {
      ffmpeg(filePath)
        .outputOptions(['-f s16le', '-acodec pcm_s16le', '-ac 1', '-ar 16000'])
        .save(tempOutputPath)
        .on('end', resolve)
        .on('error', reject);
    });

    const audioData = await fs.promises.readFile(tempOutputPath);
    console.log('Audio file converted successfully'); // Debug log

    // Process audio with WebSocket
    const response = await new Promise((resolve, reject) => {
      connectAndSendAudio(audioData, null, (transcript) => {
        console.log('Received transcript:', transcript); // Debug log
        if (!transcript || transcript === 'Error processing audio.') {
          reject(new Error('Failed to process audio'));
          return;
        }

        const result = analyzeContent(transcript);
        resolve({ transcript, result });
      });
    });

    console.log('Sending response:', response); // Debug log
    res.send({
      message: 'Audio processed successfully',
      ...response
    });

    // Clean up temporary files
    try {
      fs.unlinkSync(filePath);
      fs.unlinkSync(tempOutputPath);
    } catch (err) {
      console.error('Error cleaning up temporary files:', err);
    }
  } catch (error) {
    console.error('Error in audio processing:', error);
    res.status(500).send({
      error: 'Error processing audio',
      details: error.message
    });
  }
});

// Function to connect to OpenAI WebSocket and send audio data
function connectAndSendAudio(audioData, socket = null, callback = null) {
  console.log('Connecting to OpenAI WebSocket'); // Debug log
  
  const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01';
  const ws = new NodeWebSocket(url, {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  });

  let hasResponded = false;

  ws.on('open', function open() {
    console.log('WebSocket connection opened'); // Debug log
    ws.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: audioData.toString('base64'),
    }));

    ws.send(JSON.stringify({
      type: 'input_audio_buffer.commit',
    }));
  });

  ws.on('message', function incoming(message) {
    console.log('Received WebSocket message'); // Debug log
    try {
      const data = JSON.parse(message);
      if (data.type === 'response.audio_transcript.done' && !hasResponded) {
        hasResponded = true;
        const transcript = data.transcript || "No transcript received.";
        console.log('Processing transcript:', transcript); // Debug log
        
        if (callback) {
          callback(transcript);
        }

        ws.close();
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
      if (!hasResponded) {
        hasResponded = true;
        if (callback) {
          callback('Error processing audio.');
        }
      }
      ws.close();
    }
  });

  ws.on('error', function error(err) {
    console.error('WebSocket Error:', err);
    if (!hasResponded) {
      hasResponded = true;
      if (callback) {
        callback('Error processing audio.');
      }
    }
    ws.close();
  });

  // Add timeout handling
  setTimeout(() => {
    if (!hasResponded) {
      hasResponded = true;
      console.log('WebSocket timeout'); // Debug log
      if (callback) {
        callback('Timeout while processing audio.');
      }
      ws.close();
    }
  }, 30000); // 30 second timeout
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.send({ status: 'healthy' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).send({
    error: 'An unexpected error occurred',
    details: err.message
  });
});

// Use the environment variable PORT or fallback to 3000 for local development
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
