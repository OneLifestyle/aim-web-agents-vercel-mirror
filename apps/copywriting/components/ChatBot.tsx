
import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage, ImageContent, UsageStats } from '../types';
import { fileToBase64 } from '../utils/fileUtils';
import * as geminiService from '../services/geminiService';
import { IconBuilding, IconCamera, IconLoader, IconMessage, IconSend, IconSparkles, IconX } from '../constants';
import { Spinner } from './Spinner';

export const ChatBot: React.FC<{ onUsage?: (usage: UsageStats | undefined, prompt: string) => void }> = ({ onUsage }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Hello! How can I help you with your real estate needs today?' }
  ]);
  const [input, setInput] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() && !image) return;

    const userMessage: ChatMessage = { role: 'user', text: input };
    let imageContent: ImageContent | undefined;

    if (image) {
      const base64 = await fileToBase64(image);
      userMessage.image = `data:${image.type};base64,${base64}`;
      imageContent = { base64, mimeType: image.type };
    }

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setImage(null);
    setIsLoading(true);

    try {
      const response = await geminiService.getChatbotResponse(messages, input, imageContent);
      setMessages(prev => [...prev, { role: 'model', text: response.data }]);
      onUsage?.(response.usage, input || (imageContent ? '[image message]' : ''));
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 bg-red-600 text-white rounded-full p-4 shadow-lg hover:bg-red-700 transition-transform transform hover:scale-110 z-50"
        aria-label="Open Chat"
      >
        {isOpen ? <IconX /> : <IconMessage />}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-full max-w-sm h-[70vh] bg-white rounded-lg shadow-2xl flex flex-col z-50 border border-gray-200">
          <header className="bg-gray-50 p-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800 flex items-center">
              <IconSparkles className="text-red-500 mr-2" />
              AI Assistant
            </h3>
            <button onClick={() => setIsOpen(false)} className="text-gray-500 hover:text-gray-800"><IconX /></button>
          </header>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, index) => (
              <div key={index} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center flex-shrink-0"><IconBuilding className="w-5 h-5" /></div>}
                <div className={`max-w-[80%] rounded-xl px-4 py-2 ${msg.role === 'user' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-800'}`}>
                  {msg.image && <img src={msg.image} alt="user upload" className="rounded-lg mb-2 max-h-40" />}
                  <p className="text-sm">{msg.text}</p>
                </div>
              </div>
            ))}
            {isLoading && (
               <div className="flex gap-2 justify-start">
                   <div className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center flex-shrink-0"><IconBuilding className="w-5 h-5" /></div>
                   <div className="max-w-[80%] rounded-xl px-4 py-2 bg-gray-100 text-gray-800 flex items-center">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-1.5"></div>
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse delay-150 mr-1.5"></div>
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse delay-300"></div>
                   </div>
               </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <footer className="p-4 border-t border-gray-200 bg-white">
            {image && (
              <div className="relative mb-2 w-20">
                <img src={URL.createObjectURL(image)} alt="preview" className="w-20 h-20 object-cover rounded-md" />
                <button onClick={() => setImage(null)} className="absolute -top-2 -right-2 bg-gray-800 text-white rounded-full p-0.5"><IconX className="w-4 h-4" /></button>
              </div>
            )}
            <div className="relative flex items-center">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask me anything..."
                rows={1}
                className="w-full border border-gray-300 rounded-full py-2 pl-10 pr-20 resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <label htmlFor="chat-image-upload" className="absolute left-3 text-gray-500 hover:text-red-500 cursor-pointer">
                <IconCamera />
              </label>
              <input id="chat-image-upload" type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

              <button onClick={handleSend} disabled={isLoading} className="absolute right-2 bg-red-600 text-white rounded-full p-2 hover:bg-red-700 disabled:bg-red-400">
                <IconSend className="w-5 h-5" />
              </button>
            </div>
          </footer>
        </div>
      )}
    </>
  );
};
