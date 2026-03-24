import React, { useEffect, useState } from "react";
import HypercubeDisplay from "./HypercubeDisplay";

const HypercubePopOut = () => {
  const [hypercube, setHypercube] = useState<any | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "SET_HYPERCUBE") {
        setHypercube(event.data.payload);
      }
    };
    window.addEventListener("message", handleMessage);

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  if (!hypercube) {
    return <p className="p-4 text-gray-600">Waiting for data…</p>;
  }

  return (
    <div className="p-4 text-gray-700">
      <h1 className="text-lg font-semibold mb-4">Hypercube Viewer</h1>
      <HypercubeDisplay hypercube={hypercube} />
    </div>
  );
};

export default HypercubePopOut;
