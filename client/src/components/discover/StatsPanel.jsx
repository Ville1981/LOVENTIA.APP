// src/components/discover/StatsPanel.jsx

import React from 'react';
import PropTypes from 'prop-types';

const StatsPanel = ({ user, onAction = () => {} }) => {
  const displayName = user.name || user.username || 'Unknown';
  const youPhoto = user.youPhoto || '/assets/your-avatar.jpg';
  const profilePhoto = user.profilePhoto || '/assets/bunny-avatar.jpg';
  const compatibility = user.compatibility != null ? user.compatibility : 0;

  const userId = user.id || user._id;

  const handleAction = (id, action) => (e) => {
    e.preventDefault();
    onAction(id, action);
    e.currentTarget.blur();
  };

  return (
    <div
      className="mt-6"
      style={{
        overflowAnchor: 'none', // estetään scroll-ankkurointi
        minHeight: '4.5rem', // vakioidaan korkeus layout-shifteiltä
      }}
    >
      <h4 className="text-gray-700 font-semibold mb-2">You & {displayName}</h4>
      <div className="flex items-center space-x-2 mb-2">
        <img
          src={youPhoto}
          alt="Your avatar"
          className="w-8 h-8 rounded-full object-cover border-2 border-[#005FFF]"
        />
        <span className="text-lg font-bold text-[#005FFF]">{compatibility}%</span>
        <img
          src={profilePhoto}
          alt={`${displayName} avatar`}
          className="w-8 h-8 rounded-full object-cover border-2 border-[#005FFF]"
        />
      </div>
      <div className="flex items-center space-x-6">
        <div
          role="button"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onMouseUp={(e) => e.currentTarget.blur()}
          onClick={handleAction(userId, 'agree')}
          className="flex items-center space-x-1 cursor-pointer hover:text-[#005FFF] focus:outline-none"
        >
          <span className="font-semibold">Agree 😊</span>
          <span className="text-gray-500 text-xs">
            ({user.agreeCount != null ? user.agreeCount : 0})
          </span>
        </div>
        <div
          role="button"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onMouseUp={(e) => e.currentTarget.blur()}
          onClick={handleAction(userId, 'disagree')}
          className="flex items-center space-x-1 cursor-pointer hover:text-gray-700 focus:outline-none"
        >
          <span className="font-semibold">Disagree 😕</span>
          <span className="text-gray-500 text-xs">
            ({user.disagreeCount != null ? user.disagreeCount : 0})
          </span>
        </div>
        <div
          role="button"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onMouseUp={(e) => e.currentTarget.blur()}
          onClick={handleAction(userId, 'findOut')}
          className="flex items-center space-x-1 cursor-pointer hover:text-[#3B5998] focus:outline-none"
        >
          <span className="font-semibold">Find Out 🔮</span>
          <span className="text-gray-500 text-xs">
            ({user.findOutCount != null ? user.findOutCount : 0})
          </span>
        </div>
      </div>
    </div>
  );
};

StatsPanel.propTypes = {
  user: PropTypes.shape({
    id: PropTypes.string,
    _id: PropTypes.string.isRequired,
    username: PropTypes.string,
    name: PropTypes.string,
    compatibility: PropTypes.number,
    youPhoto: PropTypes.string,
    profilePhoto: PropTypes.string,
    agreeCount: PropTypes.number,
    disagreeCount: PropTypes.number,
    findOutCount: PropTypes.number,
  }).isRequired,
  onAction: PropTypes.func,
};

export default React.memo(StatsPanel);
