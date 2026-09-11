// frontend/src/components/Layout/Layout.jsx
import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header toggleSidebar={toggleSidebar} />
        <main className="flex-1 overflow-y-auto p-4">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;