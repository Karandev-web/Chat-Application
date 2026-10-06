import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { AuthContext } from './AuthContext';

export const SocketContext = createContext();

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connected' | 'connecting' | 'reconnecting' | 'disconnected'
  const [serverId, setServerId] = useState('');
  const { user } = useContext(AuthContext);

  useEffect(() => {
    if (user) {
      const token = localStorage.getItem('token');
      setConnectionStatus('connecting');

      const newSocket = io('http://localhost:5000', {
        auth: { token },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000
      });

      newSocket.on('connect', () => {
        console.log('Socket connected successfully:', newSocket.id);
        setConnectionStatus('connected');
      });

      newSocket.on('connection_established', (data) => {
        if (data?.serverId) {
          setServerId(data.serverId);
        }
      });

      newSocket.on('disconnect', (reason) => {
        console.warn('Socket disconnected:', reason);
        if (reason === 'io server disconnect') {
          // The server forcefully closed connection, reconnect manually
          newSocket.connect();
          setConnectionStatus('reconnecting');
        } else {
          setConnectionStatus('reconnecting');
        }
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error.message);
        setConnectionStatus('disconnected');
      });

      newSocket.io.on('reconnect_attempt', (attempt) => {
        console.log(`Socket reconnect attempt #${attempt}`);
        setConnectionStatus('reconnecting');
      });

      newSocket.io.on('reconnect', (attempt) => {
        console.log(`Socket reconnected after ${attempt} attempts`);
        setConnectionStatus('connected');
      });

      // Global receiver: mark messages delivered when received while online
      newSocket.on('receive_message', (msg) => {
        newSocket.emit('mark_message_delivered', {
          messageId: msg._id,
          senderId: msg.senderId?._id || msg.senderId
        });
      });

      setSocket(newSocket);

      return () => {
        newSocket.removeAllListeners();
        newSocket.close();
      };
    } else {
      if (socket) {
        socket.removeAllListeners();
        socket.close();
        setSocket(null);
      }
      setConnectionStatus('disconnected');
    }
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, connectionStatus, serverId }}>
      {children}
    </SocketContext.Provider>
  );
};
