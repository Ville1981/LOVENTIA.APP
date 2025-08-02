import React from 'react';

const SummaryGoalFields = ({ summary, setSummary, goal, setGoal, t }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
    <textarea
      placeholder={`📄 ${t('profile.about')}`}
      value={summary}
      onChange={(e) => setSummary(e.target.value)}
      className="p-2 border rounded w-full"
      rows={3}
    />
    <textarea
      placeholder={`🎯 ${t('profile.goals')}`}
      value={goal}
      onChange={(e) => setGoal(e.target.value)}
      className="p-2 border rounded w-full"
      rows={3}
    />
  </div>
);

export default SummaryGoalFields;
