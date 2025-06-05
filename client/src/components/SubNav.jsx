// src/components/SubNav.jsx

import React, { useState } from "react";

const SubNav = ({ tabs, activeKey }) => {
  const [active, setActive] = useState(activeKey || tabs[0].key);

  return (
    <div className="w-full bg-[#111]">
      <ul className="flex justify-center space-x-8 overflow-x-auto px-4 py-3">
        {tabs.map((item) => (
          <li
            key={item.key}
            className="flex flex-col items-center cursor-pointer"
            onClick={() => setActive(item.key)}
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

export default SubNav;
