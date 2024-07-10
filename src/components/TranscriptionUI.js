import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, Upload } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { transcribeFile, startLiveTranscription, stopLiveTranscription, getServerMetadata, getServerStats } from '../services/api';
import '../App.css';

const TranscriptionUI = () => {
  const [fileTranscription, setFileTranscription] = useState('');
  const [liveTranscription, setLiveTranscription] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [useStreaming, setUseStreaming] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [metadata, setMetadata] = useState(null);
  const [stats, setStats] = useState(null);
  const [ws, setWs] = useState(null);

  useEffect(() => {
    fetchMetadataAndStats();
  }, []);

  const fetchMetadataAndStats = async () => {
    try {
      const [metadataResponse, statsResponse] = await Promise.all([
        getServerMetadata(),
        getServerStats()
      ]);
      setMetadata(metadataResponse);
      setStats(statsResponse);
    } catch (error) {
      console.error('Error fetching metadata and stats:', error);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      try {
        if (useStreaming) {
          const reader = await transcribeFile(file, true, prompt);
          setFileTranscription('');
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = new TextDecoder().decode(value);
            setFileTranscription(prev => prev + text);
          }
        } else {
          const result = await transcribeFile(file, false, prompt);
          setFileTranscription(result.transcription);
        }
        fetchMetadataAndStats();
      } catch (error) {
        console.error('Error transcribing file:', error);
        setFileTranscription('Error transcribing file. Please try again.');
      }
    }
  };

  const toggleRecording = async () => {
    if (!isRecording) {
      try {
        const newWs = await startLiveTranscription(
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
      } catch (error) {
        console.error('Error starting live transcription:', error);
        setLiveTranscription('Error starting live transcription. Please try again.');
      }
    } else {
      stopLiveTranscription(ws);
      setWs(null);
      setIsRecording(false);
      fetchMetadataAndStats();
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6 text-center">Speech-to-Text Transcription</h1>
      <Tabs defaultValue="file" className="tabs">
        <TabsList>
          <TabsTrigger value="file" className="tab">File Transcription</TabsTrigger>
          <TabsTrigger value="live" className="tab">Live Transcription</TabsTrigger>
        </TabsList>
        <TabsContent value="file">
          <Card className="card">
            <CardHeader>
              <CardTitle>Upload Audio File</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 mb-4">
                <Input type="file" onChange={handleFileUpload} accept="audio/*" className="input" />
                <Button className="button"><Upload className="mr-2 h-4 w-4" /> Upload</Button>
              </div>
              <div className="flex items-center space-x-2 mb-4">
                <Checkbox id="streaming" checked={useStreaming} onCheckedChange={setUseStreaming} className="checkbox" />
                <label htmlFor="streaming">Use streaming</label>
              </div>
              <Input 
                type="text" 
                placeholder="Enter prompt (optional)" 
                value={prompt} 
                onChange={(e) => setPrompt(e.target.value)}
                className="input"
              />
              <div className="transcription-area">
                {fileTranscription}
              </div>
              {fileMetadata && (
                <div className="metadata">
                  <h3 className="font-bold">Transcription Metadata:</h3>
                  <p>Language: {fileMetadata.language}</p>
                  <p>Language Probability: {fileMetadata.language_probability.toFixed(2)}</p>
                  <p>Inference Time: {fileMetadata.inference_time.toFixed(2)}s</p>
                  <p>Audio Duration: {fileMetadata.audio_duration.toFixed(2)}s</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="live">
          <Card className="card">
            <CardHeader>
              <CardTitle>Live Microphone Transcription</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={toggleRecording} className="button">
                <Mic className="mr-2 h-4 w-4" />
                {isRecording ? 'Stop Recording' : 'Start Recording'}
              </Button>
              <div className="transcription-area">
                {liveTranscription}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {(serverMetadata || serverStats) && (
        <Card className="card mt-4">
          <CardHeader>
            <CardTitle>Server Information</CardTitle>
          </CardHeader>
          <CardContent>
            {serverMetadata && (
              <div className="metadata">
                <h3 className="font-bold">Metadata:</h3>
                <p>Model ID: {serverMetadata.model_id}</p>
                <p>Backend: {serverMetadata.backend}</p>
                <p>Device: {serverMetadata.device}</p>
                <p>Quantization: {serverMetadata.quantization}</p>
              </div>
            )}
            {serverStats && (
              <div className="metadata mt-2">
                <h3 className="font-bold">Stats:</h3>
                <p>Total Requests: {serverStats.total_requests}</p>
                <p>Total Audio Duration: {serverStats.total_audio_duration.toFixed(2)}s</p>
                <p>Total Inference Time: {serverStats.total_inference_time.toFixed(2)}s</p>
                <p>Average Inference Time: {serverStats.average_inference_time.toFixed(2)}s</p>
                <p>Real Time Factor: {serverStats.real_time_factor.toFixed(2)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TranscriptionUI;