import Sidebar from './Sidebar';

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-4 sm:p-4 md:p-6 ml-0 sm:ml-64 transition-all duration-300">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
