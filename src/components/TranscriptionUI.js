import React, { useState, useEffect } from 'react';
import { transcribeFile, startLiveTranscription, stopLiveTranscription, getServerMetadata, getServerStats } from '../services/api';
import '../App.css';

const TranscriptionUI = () => {
  const [fileTranscription, setFileTranscription] = useState('');
  const [fileMetadata, setFileMetadata] = useState(null);
  const [liveTranscription, setLiveTranscription] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [useStreaming, setUseStreaming] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [serverMetadata, setServerMetadata] = useState(null);
  const [serverStats, setServerStats] = useState(null);
  const [ws, setWs] = useState(null);
  const [activeTab, setActiveTab] = useState('file');
  const [selectedFile, setSelectedFile] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [streamingWords, setStreamingWords] = useState([]);

  useEffect(() => {
    fetchInitialMetadataAndStats();
  }, []);

  const fetchInitialMetadataAndStats = async () => {
    try {
      const [metadataResponse, statsResponse] = await Promise.all([
        getServerMetadata(),
        getServerStats()
      ]);
      setServerMetadata(metadataResponse);
      setServerStats(statsResponse);
    } catch (error) {
      console.error('Error fetching initial metadata and stats:', error);
    }
  };

  const fetchUpdatedMetadataAndStats = async () => {
    try {
      const [metadataResponse, statsResponse] = await Promise.all([
        getServerMetadata(),
        getServerStats()
      ]);
      setServerMetadata(metadataResponse);
      setServerStats(statsResponse);
    } catch (error) {
      console.error('Error fetching updated metadata and stats:', error);
    }
  };

  const handleFileSelection = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setFileTranscription('');
      setFileMetadata(null);
      setStreamingWords([]);
    }
  };

  const handleSubmit = async () => {
    if (selectedFile) {
      setIsTranscribing(true);
      setFileTranscription('');
      setFileMetadata(null);
      setStreamingWords([]);
      
      try {
        if (useStreaming) {
          const reader = await transcribeFile(selectedFile, true, prompt);
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim() !== '');
            lines.forEach(line => {
              if (line.startsWith('data: ')) {
                const jsonStr = line.slice(6);
                try {
                  const data = JSON.parse(jsonStr);
                  if (data.word) {
                    setStreamingWords(prev => [...prev, data.word.trim()]);
                  }
                } catch (err) {
                  console.error('Error parsing JSON:', err);
                }
              }
            });
          }
        } else {
          const result = await transcribeFile(selectedFile, false, prompt);
          setFileTranscription(result.transcription);
          setFileMetadata({
            language: result.language,
            language_probability: result.language_probability,
            inference_time: result.inference_time,
            audio_duration: result.audio_duration
          });
        }
        fetchUpdatedMetadataAndStats();
      } catch (error) {
        console.error('Error transcribing file:', error);
        setFileTranscription('Error transcribing file. Please try again.');
      } finally {
        setIsTranscribing(false);
      }
    }
  };

  const toggleRecording = () => {
    if (!isRecording) {
      const newWs = startLiveTranscription(
        (data) => {
          const words = data.words.map(w => w.word).join(' ');
          setLiveTranscription(prev => prev + ' ' + words);
        },
        (error) => {
          console.error('WebSocket error:', error);
          setLiveTranscription('Error in live transcription. Please try again.');
        }
      );
      setWs(newWs);
      setIsRecording(true);
    } else {
      stopLiveTranscription(ws);
      setWs(null);
      setIsRecording(false);
      fetchUpdatedMetadataAndStats();
    }
  };

  return (
    <div className="container">
      <h1 className="title">Speech-to-Text Transcription</h1>
      <div className="tabs">
        <button className={`tab ${activeTab === 'file' ? 'active' : ''}`} onClick={() => setActiveTab('file')}>File Transcription</button>
        <button className={`tab ${activeTab === 'live' ? 'active' : ''}`} onClick={() => setActiveTab('live')}>Live Transcription</button>
      </div>
      {activeTab === 'file' && (
        <div className="card">
          <h2>Upload Audio File</h2>
          <div className="input-group">
            <input type="file" onChange={handleFileSelection} accept="audio/*" className="input" />
          </div>
          <div className="checkbox-group">
            <input type="checkbox" id="streaming" checked={useStreaming} onChange={(e) => setUseStreaming(e.target.checked)} />
            <label htmlFor="streaming">Use streaming</label>
          </div>
          <input 
            type="text" 
            placeholder="Enter prompt (optional)" 
            value={prompt} 
            onChange={(e) => setPrompt(e.target.value)}
            className="input"
          />
          <button 
            onClick={handleSubmit} 
            className="button" 
            disabled={!selectedFile || isTranscribing}
          >
            {isTranscribing ? 'Transcribing...' : 'Start Transcription'}
          </button>
          <div className="transcription-area">
            {useStreaming ? streamingWords.join(' ') : fileTranscription}
          </div>
          {fileMetadata && !useStreaming && (
            <div className="metadata">
              <h3>Transcription Metadata:</h3>
              <p>Language: {fileMetadata.language}</p>
              <p>Language Probability: {fileMetadata.language_probability.toFixed(2)}</p>
              <p>Inference Time: {fileMetadata.inference_time.toFixed(2)}s</p>
              <p>Audio Duration: {fileMetadata.audio_duration.toFixed(2)}s</p>
            </div>
          )}
        </div>
      )}
      {activeTab === 'live' && (
        <div className="card">
          <h2>Live Microphone Transcription</h2>
          <button onClick={toggleRecording} className="button">
            {isRecording ? 'Stop Recording' : 'Start Recording'}
          </button>
          <div className="transcription-area">
            {liveTranscription}
          </div>
        </div>
      )}
      {(serverMetadata || serverStats) && (
        <div className="card">
          <h2>Server Information</h2>
          {serverMetadata && (
            <div className="metadata">
              <h3>Server Metadata:</h3>
              <p>Model ID: {serverMetadata.model_id}</p>
              <p>Backend: {serverMetadata.backend}</p>
              <p>Device: {serverMetadata.device}</p>
              <p>Quantization: {serverMetadata.quantization}</p>
            </div>
          )}
          {serverStats && (
            <div className="metadata">
              <h3>Server Statistics:</h3>
              <p>Total Requests: {serverStats.total_requests}</p>
              <p>Total Audio Duration: {serverStats.total_audio_duration.toFixed(2)}s</p>
              <p>Total Inference Time: {serverStats.total_inference_time.toFixed(2)}s</p>
              <p>Average Inference Time: {serverStats.average_inference_time.toFixed(2)}s</p>
              <p>Real Time Factor: {serverStats.real_time_factor.toFixed(2)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TranscriptionUI;