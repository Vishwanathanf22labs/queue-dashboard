import { createContext, useContext } from 'react';

const AdminLoginContext = createContext();

export const useAdminLogin = () => {
  const context = useContext(AdminLoginContext);
  if (!context) {
    throw new Error('useAdminLogin must be used within an AdminLoginProvider');
  }
  return context;
};

export default AdminLoginContext;
