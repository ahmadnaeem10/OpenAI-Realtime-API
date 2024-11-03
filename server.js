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

// Religious responses database
const religiousResponses = {
  islam: {
    general: [
      "From the Quran: 'Indeed, Allah is with those who are patient.' - Surah Al-Baqarah 2:153",
      "From the Quran: 'Indeed, with hardship [will be] ease.' - Surah Ash-Sharh 94:6",
      "From the Quran: 'Say, \"He is Allah, [Who is] One. Allah, the Eternal Refuge.\"' - Surah Al-Ikhlas 112:1-2",
      "From the Quran: 'And He is the Forgiving, the Merciful.' - Surah Al-Baqarah 2:218",
      "From the Quran: 'And when My servants ask you concerning Me, indeed I am near.' - Surah Al-Baqarah 2:186"
    ],
    prayer: [
      "The five daily prayers (Salah) are fundamental pillars of Islam: Fajr, Dhuhr, Asr, Maghrib, and Isha.",
      "The Prophet (peace be upon him) said: 'Prayer is the pillar of religion.' - Hadith"
    ],
    ramadan: [
      "The month of Ramadan is when the Quran was revealed as guidance for mankind.",
      "Fasting during Ramadan is one of the Five Pillars of Islam."
    ]
  },
  christianity: {
    general: [
      "From the Bible: 'For God so loved the world that he gave his one and only Son.' - John 3:16",
      "From the Bible: 'I can do all things through Christ who strengthens me.' - Philippians 4:13",
      "From the Bible: 'The Lord is my shepherd; I shall not want.' - Psalm 23:1",
      "From the Bible: 'Love your neighbor as yourself.' - Mark 12:31"
    ],
    prayer: [
      "The Lord's Prayer: 'Our Father who art in heaven, hallowed be thy name.'",
      "From the Bible: 'Pray without ceasing.' - 1 Thessalonians 5:17"
    ]
  },
  hinduism: {
    general: [
      "From the Bhagavad Gita: 'Whatever happened, happened for the good. Whatever is happening, is happening for the good. Whatever will happen, will also happen for the good.'",
      "From the Bhagavad Gita: 'You have the right to work, but never to the fruit of work.'",
      "From the Upanishads: 'Lead me from darkness to light, from death to immortality.'"
    ],
    karma: [
      "The law of karma states that our actions have consequences, both in this life and the next.",
      "From the Bhagavad Gita: 'The soul is neither born, nor does it die.'"
    ]
  },
  buddhism: {
    general: [
      "Buddha's teaching: 'Peace comes from within. Do not seek it without.'",
      "The Four Noble Truths teach us about the nature of suffering and the path to liberation.",
      "The Noble Eightfold Path leads to the cessation of suffering."
    ],
    meditation: [
      "Mindfulness meditation is a path to enlightenment.",
      "Buddha taught: 'All that we are is the result of what we have thought.'"
    ]
  },
  judaism: {
    general: [
      "From the Torah: 'Hear, O Israel: The Lord our God, the Lord is one.' - Deuteronomy 6:4",
      "From the Torah: 'Love your neighbor as yourself.' - Leviticus 19:18",
      "From the Talmud: 'Whoever saves one life saves the world entire.'"
    ],
    shabbat: [
      "Shabbat is the day of rest, commemorating God's rest after creation.",
      "The importance of keeping the Sabbath holy is one of the Ten Commandments."
    ]
  },
  sikhism: {
    general: [
      "From the Guru Granth Sahib: 'God is one, but known by many names.'",
      "The Five Ks are the articles of faith worn by Sikhs: Kesh, Kangha, Kara, Kachera, and Kirpan.",
      "Seva (selfless service) is a fundamental principle of Sikhism."
    ]
  }
};

// Enhanced function to detect religious themes
function detectReligiousTheme(transcript) {
  const themes = {
    islam: [/islam/i, /muslim/i, /quran/i, /allah/i, /muhammad/i, /prophet/i, /salah/i, /ramadan/i, /mosque/i],
    christianity: [/christ/i, /jesus/i, /bible/i, /gospel/i, /church/i, /christian/i, /holy spirit/i],
    hinduism: [/hindu/i, /krishna/i, /brahman/i, /karma/i, /dharma/i, /meditation/i, /yoga/i, /mandir/i],
    buddhism: [/buddha/i, /buddhist/i, /dharma/i, /meditation/i, /enlightenment/i, /nirvana/i],
    judaism: [/jewish/i, /judaism/i, /torah/i, /rabbi/i, /synagogue/i, /shabbat/i, /kosher/i],
    sikhism: [/sikh/i, /guru/i, /khalsa/i, /gurdwara/i, /waheguru/i],
    general: [/god/i, /prayer/i, /worship/i, /faith/i, /spiritual/i, /holy/i, /divine/i, /sacred/i, /blessing/i]
  };

  let detectedThemes = [];
  
  // Check for specific religious themes
  for (const [religion, patterns] of Object.entries(themes)) {
    if (patterns.some(pattern => pattern.test(transcript))) {
      detectedThemes.push(religion);
    }
  }

  return detectedThemes;
}

// Enhanced function to generate appropriate religious response
function generateReligiousResponse(transcript) {
  const detectedThemes = detectReligiousTheme(transcript);
  
  if (detectedThemes.length === 0) {
    return "I can't answer on this topic as it is not related to religion.";
  }

  let responses = [];
  
  // Generate responses based on detected themes
  for (const theme of detectedThemes) {
    if (theme === 'general') {
      // Pick a random response from any religion
      const religions = Object.keys(religiousResponses);
      const randomReligion = religions[Math.floor(Math.random() * religions.length)];
      const generalResponses = religiousResponses[randomReligion].general;
      responses.push(generalResponses[Math.floor(Math.random() * generalResponses.length)]);
    } else if (religiousResponses[theme]) {
      // Pick a response specific to the detected religion
      const religionResponses = religiousResponses[theme].general;
      responses.push(religionResponses[Math.floor(Math.random() * religionResponses.length)]);
      
      // Add specific topic responses if relevant
      for (const [topic, topicResponses] of Object.entries(religiousResponses[theme])) {
        if (topic !== 'general' && transcript.toLowerCase().includes(topic)) {
          responses.push(topicResponses[Math.floor(Math.random() * topicResponses.length)]);
        }
      }
    }
  }

  // If we have multiple responses, combine them
  return responses.length > 0 
    ? responses.join('\n\n')
    : "While this appears to be a religious topic, I need more specific context to provide an appropriate response.";
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
          // Generate response based on religious content
          const response = generateReligiousResponse(transcript);
          res.send({ 
            message: 'Audio processed successfully.', 
            transcript: transcript,
            result: response 
          });

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
      if (callback) {
        callback(transcript);
      }
    }
  });

  ws.on('error', function error(err) {
    console.error('WebSocket Error:', err);
    if (callback) {
      callback('Error processing audio.');
    }
  });
}

// Use the environment variable PORT or fallback to 3000 for local development
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
