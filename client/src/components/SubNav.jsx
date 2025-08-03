import React, { useState, useEffect, memo } from "react";
import PropTypes from "prop-types";

const SubNav = ({ tabs, activeKey = "", onChange = () => {} }) => {
  const [active, setActive] = useState(
    activeKey || (tabs.length > 0 ? tabs[0].key : "")
  );

  useEffect(() => {
    if (activeKey && activeKey !== active) {
      setActive(activeKey);
    }
  }, [activeKey]);

  const handleClick = (key) => {
    setActive(key);
    onChange(key);
  };

  return (
    <div className="w-full bg-[#111]">
      <ul className="flex justify-center space-x-6 overflow-x-auto scrollbar-none whitespace-nowrap px-4 py-3">
        {tabs.map((item) => (
          <li
            key={item.key}
            className="flex flex-col items-center cursor-pointer hover:opacity-90 transition"
            onClick={() => handleClick(item.key)}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition ${
                active === item.key
                  ? "border-[#FF4081] bg-[#222]"
                  : "border-transparent bg-[#1a1a1a]"
              }`}
            >
              <img
                src={item.icon}
                alt={`${item.label} icon`}
                className="w-7 h-7"
              />
            </div>
            <span
              className={`mt-1 text-[12px] font-medium text-center break-keep ${
                active === item.key ? "text-[#FF4081]" : "text-[#ccc]"
              }`}
            >
              {item.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

SubNav.propTypes = {
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      icon: PropTypes.string.isRequired,
    })
  ).isRequired,
  activeKey: PropTypes.string,
  onChange: PropTypes.func,
};

export default memo(SubNav);
