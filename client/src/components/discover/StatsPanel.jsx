import React from "react";
import PropTypes from "prop-types";

const StatsPanel = ({ user, onAction = () => {} }) => {
  const displayName = user.name || user.username || "Unknown";
  const youPhoto    = user.youPhoto      || "/assets/your-avatar.jpg";
  const profilePhoto= user.profilePhoto  || "/assets/bunny-avatar.jpg";
  const compatibility = user.compatibility != null ? user.compatibility : 0;

  return (
    <div className="mt-6">
      <h4 className="text-gray-700 font-semibold mb-2">
        You & {displayName}
      </h4>
      <div className="flex items-center space-x-2 mb-2">
        <img
          src={youPhoto}
          alt="Your avatar"
          className="w-8 h-8 rounded-full object-cover border-2 border-[#005FFF]"
        />
        <span className="text-lg font-bold text-[#005FFF]">
          {compatibility}%
        </span>
        <img
          src={profilePhoto}
          alt={`${displayName} avatar`}
          className="w-8 h-8 rounded-full object-cover border-2 border-[#005FFF]"
        />
      </div>
      <div className="flex items-center space-x-6">
        <div
          className="flex items-center space-x-1 cursor-pointer hover:text-[#005FFF]"
          onClick={() => onAction(user.id || user._id, "agree")}
        >
          <span className="font-semibold">Agree 😊</span>
          <span className="text-gray-500 text-xs">
            ({user.agreeCount != null ? user.agreeCount : 0})
          </span>
        </div>
        <div
          className="flex items-center space-x-1 cursor-pointer hover:text-gray-700"
          onClick={() => onAction(user.id || user._id, "disagree")}
        >
          <span className="font-semibold">Disagree 😕</span>
          <span className="text-gray-500 text-xs">
            ({user.disagreeCount != null ? user.disagreeCount : 0})
          </span>
        </div>
        <div
          className="flex items-center space-x-1 cursor-pointer hover:text-[#3B5998]"
          onClick={() => onAction(user.id || user._id, "findOut")}
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
    id:             PropTypes.string,
    _id:            PropTypes.string.isRequired,
    username:       PropTypes.string,
    name:           PropTypes.string,
    compatibility:  PropTypes.number,
    youPhoto:       PropTypes.string,
    profilePhoto:   PropTypes.string,
    agreeCount:     PropTypes.number,
    disagreeCount:  PropTypes.number,
    findOutCount:   PropTypes.number,
  }).isRequired,
  onAction: PropTypes.func,
};

export default React.memo(StatsPanel);
