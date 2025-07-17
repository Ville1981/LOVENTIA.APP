// client/src/components/CardList.jsx
import React, { memo } from "react";
import PropTypes from "prop-types";

const CardList = ({ items, CardComponent, onAction, emptyMessage }) => {
  if (!items || items.length === 0) {
    return <p className="text-center text-gray-500 mt-6">{emptyMessage}</p>;
  }
  return (
    <div className="flex flex-col items-center mt-6 space-y-6">
      {items.map(item => (
        <div key={item._id || item.id} className="w-full max-w-[800px]">
          <CardComponent user={item} onAction={onAction} />
        </div>
      ))}
    </div>
  );
};

CardList.propTypes = {
  items: PropTypes.array.isRequired,
  CardComponent: PropTypes.elementType.isRequired,
  onAction: PropTypes.func,
  emptyMessage: PropTypes.string,
};

CardList.defaultProps = {
  onAction: () => {},
  emptyMessage: "🔍 Ei hakutuloksia",
};

export default memo(CardList);
