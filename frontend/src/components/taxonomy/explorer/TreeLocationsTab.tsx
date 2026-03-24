const TreeLocationsTab: React.FC<{ qname: string }> = ({ qname }) => {
  return (
    <div className="p-4 text-gray-700">
      <p>Tree location view for: <strong>{qname}</strong></p>
    </div>
  );
};
export default TreeLocationsTab;