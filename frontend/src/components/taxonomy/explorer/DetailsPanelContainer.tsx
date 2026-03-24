import React, { useEffect, useState } from 'react';
import DetailsTab from './DetailsTab';
import HypercubeRelationshipsTab from './HypercubeRelationshipsTab';
import TreeLocationsTab from './TreeLocationsTab';

interface DetailPanelProps {
  selectedNode: any;
  onNavigateToNode?: (qname: string) => void;
  onNavigateToCrossReference?: (qname: string) => void;
   language: 'en' | 'cy'; 
}

const DetailPanelContainer: React.FC<DetailPanelProps> = ({
  selectedNode,
  onNavigateToNode,
  onNavigateToCrossReference,
  language
}) => {
  const [activeTab, setActiveTab] = useState('Details');
  const [concept, setConcept] = useState<any | null>(null);

  useEffect(() => {
    if (selectedNode?.data?.qname) {
      const qname = selectedNode.data.qname;
      fetch(`/api/concept-details?qname=${encodeURIComponent(qname)}`)
        .then(res => res.json())
        .then(data => setConcept(data))
        .catch(err => {
          console.error('Error fetching concept:', err);
          setConcept(null);
        });
    } else {
      setConcept(null);
    }
  }, [selectedNode]);

  if (!selectedNode) {
    return <div className="p-4 text-gray-500 text-center">Please select a concept.</div>;
  }

  if (!concept) {
    return <div className="p-4 text-gray-500 text-center">No concept data found.</div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex border-b">
        {['Details', 'Hypercube Relationships', 'Tree Locations'].map(tab => (
          <button
            key={tab}
            className={`px-4 py-1 text-sm font-medium ${activeTab === tab ? 'bg-white border-b-2 border-blue-500' : 'bg-gray-100'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'Details' && (
          <DetailsTab concept={concept} selectedNode={selectedNode} onNavigateToNode={onNavigateToNode} onNavigateToCrossReference={onNavigateToCrossReference} />
        )}
        {activeTab === 'Hypercube Relationships' && (
          <HypercubeRelationshipsTab qname={concept.concept.qname} language={language}/>
        )}
        {activeTab === 'Tree Locations' && (
          <TreeLocationsTab qname={concept.concept.qname} />
        )}
      </div>
    </div>
  );
};

export default DetailPanelContainer;
