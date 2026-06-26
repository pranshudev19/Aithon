import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { socket } from '../socket';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
  axios.defaults.withCredentials = true;

  const checkAuth = async () => {
    try {
      const { data } = await axios.get('/me');
      setUser(data.user);
      
      // Connect socket on successful auth
      socket.connect();
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
    
    // Cleanup socket on unmount
    return () => {
      socket.disconnect();
    };
  }, []);

  const login = async (email, password) => {
    const { data } = await axios.post('/auth/login', { email, password });
    setUser(data.user);
    socket.connect();
    return data.user;
  };

  const logout = async () => {
    await axios.post('/auth/logout');
    setUser(null);
    socket.disconnect();
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
