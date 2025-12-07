import React from 'react';
import { Tab } from '../types';
import { Flame, Library, Search } from 'lucide-react';

interface NavbarProps {
  currentTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const Navbar: React.FC<NavbarProps> = ({ currentTab, onTabChange }) => {
  const getIconClass = (tab: Tab) => 
    `flex flex-col items-center gap-1 p-2 transition-all duration-300 ${
      currentTab === tab ? 'text-white' : 'text-gray-400 hover:text-white'
    }`;

  return (
    <div className="fixed bottom-0 left-0 w-full bg-black/95 backdrop-blur-md border-t border-white/10 z-50 pb-safe">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto">
        <button onClick={() => onTabChange(Tab.Trending)} className={getIconClass(Tab.Trending)}>
          <Flame size={22} strokeWidth={currentTab === Tab.Trending ? 2.5 : 2} />
          <span className="text-[9px] font-medium">Trending</span>
        </button>
        
        <button onClick={() => onTabChange(Tab.MyFeed)} className={getIconClass(Tab.MyFeed)}>
          <Library size={22} strokeWidth={currentTab === Tab.MyFeed ? 2.5 : 2} />
          <span className="text-[9px] font-medium">My Feed</span>
        </button>

        <button onClick={() => onTabChange(Tab.Search)} className={getIconClass(Tab.Search)}>
          <Search size={22} strokeWidth={currentTab === Tab.Search ? 2.5 : 2} />
          <span className="text-[9px] font-medium">Search</span>
        </button>
      </div>
    </div>
  );
};

export default Navbar;