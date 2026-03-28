import { createBrowserRouter, Navigate } from 'react-router-dom';
import AuthGuard from './AuthGuard';
import LoginPage from '@/features/auth/LoginPage';
import RegisterPage from '@/features/auth/RegisterPage';
import ChatPage from '@/features/chat/ChatPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    element: <AuthGuard />,
    children: [
      { path: '/chat/:sessionId?', element: <ChatPage /> },
      { path: '/', element: <Navigate to="/chat" replace /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
