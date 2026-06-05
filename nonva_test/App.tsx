import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { OrderProvider } from './context/OrderContext';
import Navbar from './components/Navbar';
import CustomerPage from './pages/CustomerPage';
import AdminPage from './pages/AdminPage';

const App: React.FC = () => {
  return (
    <OrderProvider>
      <Router>
        <div className="min-h-screen bg-gray-50 text-gray-900 font-['Vazirmatn']" dir="rtl">
          <Navbar />
          <main className="p-4 md:p-8">
            <Routes>
              <Route path="/" element={<CustomerPage />} />
              <Route path="/admin" element={<AdminPage />} />
            </Routes>
          </main>
        </div>
      </Router>
    </OrderProvider>
  );
};

export default App;