import React from "react";

const AdvancedSearchTab: React.FC = () => {
  return (
    <div className="p-4 text-gray-600 space-y-2">
      <p className="font-medium text-sm">Advanced Search</p>
      <p className="text-sm">
        Advanced search controls will be added in the next PRs.
      </p>
      <p className="text-xs text-gray-500">
        This tab is intentionally available even when no concept is selected.
      </p>
    </div>
  );
};

export default AdvancedSearchTab;