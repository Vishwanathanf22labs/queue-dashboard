import { useState, useEffect } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { navItems } from '../../constants/data';

import Button from '../ui/Button';

const Sidebar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  const handleSidebarScroll = (e) => {
    const sidebar = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = sidebar;

    if (scrollTop === 0 && e.deltaY < 0) {
      e.stopPropagation();
      return false;
    }

    if (scrollTop + clientHeight >= scrollHeight - 1 && e.deltaY > 0) {
      e.stopPropagation();
      return false;
    }
  };

  const handleTouchMove = (e) => {
    const sidebar = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = sidebar;

    if (scrollTop === 0) {
      e.preventDefault();
    }

    if (scrollTop + clientHeight >= scrollHeight - 1) {
      e.preventDefault();
    }
  };

  return (
    <>
      <Button
        variant="mobile-menu"
        size="sm"
        onClick={toggleMobileMenu}
        className="fixed top-4 right-4 z-[9999] p-2 md:hidden"
        style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          zIndex: 9999,
          transform: 'none'
        }}
      >
        {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </Button>


      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-white bg-opacity-90 z-[9998] md:hidden touch-none"
          onClick={closeMobileMenu}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh'
          }}
        />
      )}


      <div className={`fixed left-0 top-0 w-64 bg-gray-900 shadow-lg z-[9999] transform transition-transform duration-300 ease-in-out flex flex-col ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        style={{
          height: '100vh',
          bottom: 0,
          maxHeight: '100vh'
        }}
      >
        <div className="flex items-center justify-center h-16 bg-gray-800 flex-shrink-0">
          <Link to="/" onClick={closeMobileMenu}>
            <img
              src="./madAngleLogoUpdated.svg"
              alt="Madangles Dashboard"
              className="h-10 w-auto cursor-pointer hover:opacity-80 transition-opacity mt-3"
            />
          </Link>
        </div>

        <div
          className="flex-1 overflow-y-auto scrollbar-hide"
          onWheel={handleSidebarScroll}
          onTouchMove={handleTouchMove}
          style={{
            overscrollBehavior: 'contain',
            maxHeight: 'calc(100vh - 64px)'
          }}
        >

          <nav className="space-y-2 p-6">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={closeMobileMenu}
                  className={({ isActive }) =>
                    `flex items-center px-4 py-3 rounded-lg transition-colors ${isActive
                      ? 'bg-yellow-500 text-gray-900'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
};

export default Sidebar;