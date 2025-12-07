import React from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { CATEGORIES } from '../constants';

interface SearchProps {
  onCategorySelect?: (category: string) => void;
}

const Search: React.FC<SearchProps> = ({ onCategorySelect }) => {
  return (
    <div className="w-full h-full bg-black text-white p-4 pt-8 pb-32 overflow-y-auto no-scrollbar">
      {/* Search Input */}
      <div className="sticky top-0 bg-black z-10 pb-6 pt-2">
        <h1 className="text-3xl font-bold mb-4">Search</h1>
        <div className="relative group">
          <SearchIcon className="absolute left-4 top-3.5 text-gray-800 w-5 h-5 group-focus-within:text-white transition-colors" />
          <input 
            type="text" 
            placeholder="What do you want to listen to?" 
            className="w-full bg-white text-black placeholder-gray-500 font-medium rounded-md py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-white"
          />
        </div>
      </div>

      {/* Browse All Section - Coming Soon State */}
      <div className="space-y-4 relative">
        <h2 className="text-lg font-bold">Browse all</h2>
        
        {/* Overlay */}
        <div className="absolute inset-0 z-10 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center text-center p-4 -mx-4 rounded-xl border border-white/10 mt-10">
          <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mb-3 shadow-lg shadow-white/20">
            <SearchIcon size={24} className="text-black" />
          </div>
          <h3 className="text-xl font-bold mb-1">Coming Soon</h3>
          <p className="text-sm text-gray-300 max-w-[200px]">
            We're building a new way to explore. Stay tuned!
          </p>
        </div>

        {/* Disabled Grid */}
        <div className="grid grid-cols-2 gap-4 opacity-40 pointer-events-none grayscale-[0.5]">
          {CATEGORIES.map((category) => (
            <div 
              key={category.id}
              className={`${category.color} aspect-[1.6] rounded-md relative overflow-hidden p-3`}
            >
              <h3 className="text-lg font-bold leading-tight break-words w-2/3">{category.name}</h3>
              {/* Decorative rotated box to simulate image */}
              <div className="absolute -bottom-2 -right-4 w-16 h-16 bg-black/20 transform rotate-[25deg] rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Search;