require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const upload = multer();
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Simple health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// GET /api/youtube-audio?url=...
app.get('/api/youtube-audio', (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) {
    return res.status(400).json({ error: 'Missing url query parameter' });
  }

  // Try multiple client strategies to avoid 403 errors
  // Strategy 1: Try web client first (no PO token required)
  // Then fallback to iOS, then simple format selector
  const tryDownload = (clientType = 'web', attempt = 1) => {
    let args = ['-f', 'bestaudio/best[height<=480]/worst', '-o', '-', videoUrl];
    
    if (clientType === 'ios') {
      args = ['-f', 'bestaudio/best[height<=480]/worst', '--extractor-args', 'youtube:player_client=ios', '-o', '-', videoUrl];
    } else if (clientType === 'none') {
      // Try with simplest format selector, no client restrictions
      args = ['-f', 'bestaudio', '-o', '-', videoUrl];
    }
    // 'web' uses default client (no special args needed)

    const ytdlp = spawn('yt-dlp', args);

    let hasData = false;
    let errorOutput = '';
    let firstChunk = true;
    
    ytdlp.stdout.on('data', (chunk) => {
      hasData = true;
      if (firstChunk) {
        firstChunk = false;
        res.writeHead(200, {
          'Content-Type': 'audio/webm',
          'Transfer-Encoding': 'chunked',
          'Cache-Control': 'no-cache'
        });
      }
      res.write(chunk);
    });

    ytdlp.stderr.on('data', (data) => {
      const errorStr = data.toString();
      errorOutput += errorStr;
      console.error(`yt-dlp stderr (${clientType}): ${errorStr}`);
    });

    ytdlp.on('error', (err) => {
      console.error(`Failed to start yt-dlp (${clientType}):`, err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to start yt-dlp' });
      } else {
        res.end();
      }
    });

    ytdlp.on('close', (code) => {
      if (code !== 0 || !hasData) {
        // Try fallback clients
        if (clientType === 'web' && attempt === 1) {
          console.log('Web client failed, trying iOS client...');
          return tryDownload('ios', 2);
        } else if (clientType === 'ios' && attempt === 2) {
          console.log('iOS client failed, trying without client restrictions...');
          // Try with just bestaudio, no client restrictions
          return tryDownload('none', 3);
        } else {
          // All clients failed
          console.error(`yt-dlp failed with all clients. Last error: ${errorOutput}`);
          if (!res.headersSent) {
            let errorMsg = 'yt-dlp failed to download audio';
            if (errorOutput.includes('403') || errorOutput.includes('Forbidden')) {
              errorMsg = 'YouTube blocked the request (403 Forbidden). Try updating yt-dlp: pip install --upgrade yt-dlp';
            } else if (errorOutput.includes('format is not available')) {
              errorMsg = 'No compatible audio format available. The video may be restricted or unavailable.';
            }
            res.status(500).json({ 
              error: errorMsg,
              details: errorOutput.substring(0, 300)
            });
          } else if (!hasData) {
            res.status(500).json({ error: 'No audio data received' });
          }
          res.end();
        }
      } else {
        res.end();
      }
    });
  };

  tryDownload();
});

// GET /api/youtube-video?url=...
app.get('/api/youtube-video', (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) {
    return res.status(400).json({ error: 'Missing url query parameter' });
  }

  // Try multiple client strategies to avoid 403 errors
  // Strategy 1: Try web client first (no PO token required)
  const tryDownload = (clientType = 'web', attempt = 1) => {
    let args = [
      '-f', 'best[height<=360]/best[height<=480]/worst',
      '--merge-output-format', 'mp4',
      '-o', '-',
      videoUrl
    ];
    
    if (clientType === 'ios') {
      args.splice(4, 0, '--extractor-args', 'youtube:player_client=ios');
    } else if (clientType === 'none') {
      // Try with simplest format selector, no client restrictions
      args = ['-f', 'best[height<=360]/worst', '--merge-output-format', 'mp4', '-o', '-', videoUrl];
    }
    // 'web' uses default client (no special args needed)

    const ytdlp = spawn('yt-dlp', args);

    let hasData = false;
    let errorOutput = '';
    let firstChunk = true;
    
    ytdlp.stdout.on('data', (chunk) => {
      hasData = true;
      if (firstChunk) {
        firstChunk = false;
        res.writeHead(200, {
          'Content-Type': 'video/mp4',
          'Transfer-Encoding': 'chunked',
          'Cache-Control': 'no-cache'
        });
      }
      res.write(chunk);
    });

    ytdlp.stderr.on('data', (data) => {
      const errorStr = data.toString();
      errorOutput += errorStr;
      console.error(`yt-dlp video stderr (${clientType}): ${errorStr}`);
    });

    ytdlp.on('error', (err) => {
      console.error(`Failed to start yt-dlp for video (${clientType}):`, err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to start yt-dlp' });
      } else {
        res.end();
      }
    });

    ytdlp.on('close', (code) => {
      if (code !== 0 || !hasData) {
        // Try fallback clients
        if (clientType === 'web' && attempt === 1) {
          console.log('Web client failed for video, trying iOS client...');
          return tryDownload('ios', 2);
        } else if (clientType === 'ios' && attempt === 2) {
          console.log('iOS client failed for video, trying simple format...');
          return tryDownload('none', 3);
        } else {
          // All clients failed
          console.error(`yt-dlp video failed with all clients. Last error: ${errorOutput}`);
          if (!res.headersSent) {
            let errorMsg = 'yt-dlp failed to download video';
            if (errorOutput.includes('403') || errorOutput.includes('Forbidden')) {
              errorMsg = 'YouTube blocked the request (403 Forbidden). Try updating yt-dlp: pip install --upgrade yt-dlp';
            } else if (errorOutput.includes('format is not available')) {
              errorMsg = 'No compatible video format available. The video may be restricted or unavailable.';
            }
            res.status(500).json({ 
              error: errorMsg,
              details: errorOutput.substring(0, 300)
            });
          } else if (!hasData) {
            res.status(500).json({ error: 'No video data received' });
          }
          res.end();
        }
      } else {
        res.end();
      }
    });
  };

  tryDownload();
});
// Transcription endpoint for file uploads (local files, default audio)
app.post('/api/transcribe-upload', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        const API_KEY = process.env.ASSEMBLYAI_API_KEY;
        if (!API_KEY) {
            return res.status(500).json({ error: 'AssemblyAI API key not configured' });
        }

        console.log('Uploading audio to AssemblyAI...');

        // Upload to AssemblyAI
        const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
            method: 'POST',
            headers: {
                'Authorization': API_KEY,
            },
            body: req.file.buffer
        });

        const { upload_url } = await uploadResponse.json();
        console.log('Audio uploaded, starting transcription...');

        // Start transcription
        const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
            method: 'POST',
            headers: {
                'Authorization': API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                audio_url: upload_url,
                speaker_labels: false,
                punctuate: true,
                format_text: true
            })
        });

        const transcript = await transcriptResponse.json();
        const transcriptId = transcript.id;

        // Poll for completion
        let result;
        while (true) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const pollingResponse = await fetch(
                `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
                { headers: { 'Authorization': API_KEY } }
            );
            
            result = await pollingResponse.json();
            
            if (result.status === 'completed') {
                console.log('Transcription completed!');
                break;
            } else if (result.status === 'error') {
                throw new Error(result.error || 'Transcription failed');
            }
            
            console.log(`Transcription status: ${result.status}...`);
        }

        res.json({
            text: result.text,
            words: result.words ? result.words.map (w => ({
                text: w.text,
                start: w.start / 1000,
                end: w.end / 1000
            })) : []
        });

    } catch (error) {
        console.error('Transcription error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Transcription endpoint for public URLs (YouTube, etc)
app.post('/api/transcribe', async (req, res) => {
    try {
        const { audioUrl } = req.body;
        
        if (!audioUrl) {
            return res.status(400).json({ error: 'No audio URL provided' });
        }

        const API_KEY = process.env.ASSEMBLYAI_API_KEY;
        if (!API_KEY) {
            return res.status(500).json({ error: 'AssemblyAI API key not configured' });
        }

        console.log('Fetching audio from:', audioUrl);

        // Fetch the audio
        const audioResponse = await fetch(audioUrl);
        const audioBuffer = await audioResponse.arrayBuffer();

        // Upload to AssemblyAI
        const uploadResponse = await fetch('https://api.assemblyai.com/v2/upload', {
            method: 'POST',
            headers: {
                'Authorization': API_KEY,
            },
            body: Buffer.from(audioBuffer)
        });

        const { upload_url } = await uploadResponse.json();
        console.log('Audio uploaded, starting transcription...');

        // Start transcription
        const transcriptResponse = await fetch('https://api.assemblyai.com/v2/transcript', {
            method: 'POST',
            headers: {
                'Authorization': API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                audio_url: upload_url,
                speaker_labels: false,
                punctuate: true,
                format_text: true
            })
        });

        const transcript = await transcriptResponse.json();
        const transcriptId = transcript.id;

        // Poll for completion
        let result;
        while (true) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const pollingResponse = await fetch(
                `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
                { headers: { 'Authorization': API_KEY } }
            );
            
            result = await pollingResponse.json();
            
            if (result.status === 'completed') {
                console.log('Transcription completed!');
                break;
            } else if (result.status === 'error') {
                throw new Error(result.error || 'Transcription failed');
            }
            
            console.log(`Transcription status: ${result.status}...`);
        }

        res.json({
            text: result.text,
            words: result.words ? result.words.map(w => ({
                text: w.text,
                start: w.start / 1000,
                end: w.end / 1000
            })) : []
        });
    } catch (error) {
        console.error('Transcription error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});