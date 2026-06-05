import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChefHat, LayoutDashboard, PlusCircle } from 'lucide-react';

const Navbar: React.FC = () => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2">
              <div className="bg-orange-100 p-1.5 sm:p-2 rounded-full">
                <ChefHat className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
              </div>
              <span className="font-bold text-lg sm:text-xl text-gray-800">نانوا</span>
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/"
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                isActive('/') ? 'bg-orange-50 text-orange-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span className="hidden xs:inline">ثبت سفارش</span>
              <span className="xs:hidden">سفارش</span>
            </Link>
            <Link
              to="/admin"
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                isActive('/admin') ? 'bg-orange-50 text-orange-700' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden xs:inline">مدیریت</span>
              <span className="xs:hidden">پنل</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;