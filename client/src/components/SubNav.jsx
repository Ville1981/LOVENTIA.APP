import React, { useState, useEffect, memo } from "react";
import PropTypes from "prop-types";

const SubNav = ({ tabs, activeKey, onChange }) => {
  const [active, setActive] = useState(activeKey || (tabs.length > 0 ? tabs[0].key : ""));

  useEffect(() => {
    if (activeKey && activeKey !== active) {
      setActive(activeKey);
    }
  }, [activeKey]);

  const handleClick = (key) => {
    setActive(key);
    if (typeof onChange === "function") {
      onChange(key);
    }
  };

  return (
    <div className="w-full bg-[#111]">
      <ul className="flex justify-center space-x-8 overflow-x-auto px-4 py-3">
        {tabs.map((item) => (
          <li
            key={item.key}
            className="flex flex-col items-center cursor-pointer"
            onClick={() => handleClick(item.key)}
          >
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${
                active === item.key ? "border-[#FF4081]" : "border-transparent"
              }`}
            >
              <img
                src={item.icon}
                alt={`${item.label} icon`}
                className="w-8 h-8"
              />
            </div>
            <span
              className={`mt-1 text-[12px] font-medium ${
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

SubNav.defaultProps = {
  activeKey: undefined,
  onChange: undefined,
};

export default memo(SubNav);
