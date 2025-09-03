import { useState, useEffect } from 'react';
import Button from './Button';
import Input from './Input';
import { Lock, User, X } from 'lucide-react';
import useAdminStore from '../../stores/adminStore';
import toast from 'react-hot-toast';

const AdminLoginModal = ({ isOpen, onClose, onLoginSuccess }) => {
  const { login } = useAdminStore();

  const [formState, setFormState] = useState({
    username: '',
    password: '',
    showPassword: false,
    isSubmitting: false,
  });

  const { username, password, isSubmitting } = formState;

  const updateFormState = (updates) => {
    setFormState(prev => ({ ...prev, ...updates }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) return;

    try {
      updateFormState({ isSubmitting: true });
      await login({ username: username.trim(), password: password.trim() });
      onClose();
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (error) {
      toast.error(error.message || 'Login failed. Please try again.');
    } finally {
      updateFormState({ isSubmitting: false });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateFormState({
        username: '',
        password: '',
        showPassword: false,
        isSubmitting: false,
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-auto"
        onKeyDown={handleKeyDown}
      >

        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Lock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Admin Access</h2>
              <p className="text-sm text-gray-500">Enter your credentials</p>
            </div>
          </div>
          <Button
            onClick={onClose}
            size="sm"
            variant="ghost"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          <Input
            label="Username"
            id="username"
            type="text"
            value={username}
            onChange={(value) => updateFormState({ username: value })}
            placeholder="Enter username"
            leftIcon={<User className="h-5 w-5 text-gray-400" />}
            required={true}
            autoFocus={true}
            size="md"
            variant="default"
          />

          <Input
            label="Password"
            id="password"
            type="password"
            value={password}
            onChange={(value) => updateFormState({ password: value })}
            placeholder="Enter password"
            leftIcon={<Lock className="h-5 w-5 text-gray-400" />}
            showPasswordToggle={true}
            required={true}
            size="md"
            variant="default"
          />

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={isSubmitting || !username.trim() || !password.trim()}
            className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? 'Signing In...' : 'Sign In'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AdminLoginModal;