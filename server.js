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

// Comprehensive religious content database
const religiousContent = {
  islam: {
    keywords: ['allah', 'quran', 'islamic', 'muslim', 'mohammad', 'mosque', 'namaz', 'salah', 'ramadan', 'eid'],
    verses: [
      { text: "Indeed, with hardship [will be] ease.", source: "Surah Ash-Sharh 94:6" },
      { text: "And when My servants ask you concerning Me - indeed I am near.", source: "Surah Al-Baqarah 2:186" },
      { text: "For indeed, with hardship [will be] ease. Indeed, with hardship [will be] ease.", source: "Surah Ash-Sharh 94:5-6" }
    ]
  },
  christianity: {
    keywords: ['jesus', 'christ', 'bible', 'christian', 'church', 'gospel', 'holy spirit', 'cross'],
    verses: [
      { text: "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.", source: "John 3:16" },
      { text: "I can do all things through Christ who strengthens me.", source: "Philippians 4:13" },
      { text: "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.", source: "Jeremiah 29:11" }
    ]
  },
  hinduism: {
    keywords: ['krishna', 'vishnu', 'shiva', 'rama', 'hindu', 'temple', 'mandir', 'dharma', 'karma'],
    verses: [
      { text: "You have the right to work, but never to the fruit of work. You should never engage in action for the sake of reward.", source: "Bhagavad Gita 2:47" },
      { text: "Whatever happened, happened for the good. Whatever is happening, is happening for the good. Whatever will happen, will also happen for the good.", source: "Bhagavad Gita" },
      { text: "The soul is neither born, nor does it die. It is not slain when the body is slain.", source: "Bhagavad Gita 2:20" }
    ]
  },
  buddhism: {
    keywords: ['buddha', 'buddhist', 'dharma', 'meditation', 'nirvana', 'sangha'],
    verses: [
      { text: "Peace comes from within. Do not seek it without.", source: "Buddha" },
      { text: "Three things cannot be long hidden: the sun, the moon, and the truth.", source: "Buddha" },
      { text: "The mind is everything. What you think you become.", source: "Buddha" }
    ]
  },
  judaism: {
    keywords: ['torah', 'jewish', 'synagogue', 'rabbi', 'shabbat', 'kosher', 'hebrew'],
    verses: [
      { text: "The Lord bless you and keep you; The Lord make His face shine upon you, And be gracious to you.", source: "Numbers 6:24-25" },
      { text: "Trust in the Lord with all your heart and lean not on your own understanding.", source: "Proverbs 3:5" },
      { text: "For everything there is a season, and a time for every purpose under heaven.", source: "Ecclesiastes 3:1" }
    ]
  },
  sikhism: {
    keywords: ['guru', 'sikh', 'waheguru', 'gurdwara', 'khalsa'],
    verses: [
      { text: "Where there is divine knowledge, there is righteousness. Where there is falsehood, there is sin.", source: "Guru Granth Sahib" },
      { text: "God is one, but he has innumerable forms. He is the creator of all and He himself takes the human form.", source: "Guru Granth Sahib" }
    ]
  }
};

// Function to analyze content and provide appropriate religious response
function analyzeContent(transcript) {
  const lowercaseTranscript = transcript.toLowerCase();
  
  // Check each religion's keywords
  for (const [religion, content] of Object.entries(religiousContent)) {
    const hasKeyword = content.keywords.some(keyword => 
      lowercaseTranscript.includes(keyword.toLowerCase())
    );

    if (hasKeyword) {
      // Select a random verse from the matching religion
      const randomVerse = content.verses[Math.floor(Math.random() * content.verses.length)];
      return {
        type: 'religious',
        religion: religion,
        response: `From ${religion.charAt(0).toUpperCase() + religion.slice(1)}: "${randomVerse.text}" - ${randomVerse.source}`
      };
    }
  }

  // Check for general religious terms
  const generalReligiousTerms = ['god', 'prayer', 'faith', 'spiritual', 'divine', 'holy', 'sacred', 'blessing'];
  const isGeneralReligious = generalReligiousTerms.some(term => 
    lowercaseTranscript.includes(term.toLowerCase())
  );

  if (isGeneralReligious) {
    // Provide a general spiritual response
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
app.post('/process-audio', upload.single('audioFile'), (req, res) => {
  if (!req.file) {
    return res.status(400).send({ error: 'No audio file provided.' });
  }

  const filePath = req.file.path;
  const tempOutputPath = path.join(tmpdir(), `processed-${Date.now()}.wav`);

  // Convert and process the audio file
  ffmpeg(filePath)
    .outputOptions(['-f s16le', '-acodec pcm_s16le', '-ac 1', '-ar 16000'])
    .save(tempOutputPath)
    .on('end', () => {
      fs.readFile(tempOutputPath, (err, audioData) => {
        if (err) {
          console.error('Error reading audio file:', err);
          res.status(500).send({ error: 'Error reading processed audio file.' });
          return;
        }

        // Process audio with WebSocket
        connectAndSendAudio(audioData, null, (transcript) => {
          // Analyze and return the result based on content
          const response = analyzeContent(transcript);
          res.send({ 
            message: 'Audio processed successfully.',
            transcript: transcript,
            result: response 
          });

          // Clean up temporary files
          try {
            fs.unlinkSync(filePath);
            fs.unlinkSync(tempOutputPath);
          } catch (err) {
            console.error('Error cleaning up temporary files:', err);
          }
        });
      });
    })
    .on('error', (err) => {
      console.error('Error converting audio:', err);
      res.status(500).send({ error: 'Error processing file.' });
      
      // Clean up the input file on error
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupErr) {
        console.error('Error cleaning up input file:', cleanupErr);
      }
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
      
      // Send transcript via callback
      if (callback) {
        callback(transcript);
      }

      // Close the WebSocket connection
      ws.close();
    }
  });

  ws.on('error', function error(err) {
    console.error('WebSocket Error:', err);
    if (callback) {
      callback('Error processing audio.');
    }
    ws.close();
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.send({ status: 'healthy' });
});

// Use the environment variable PORT or fallback to 3000 for local development
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
