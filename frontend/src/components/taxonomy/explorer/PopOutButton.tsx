import React from "react";

const PopOutButton: React.FC<{ hypercube: any }> = ({ hypercube }) => {
  const openPopoutWindow = () => {
    const popout = window.open(
      "/hypercube-popout",
      "_blank",
      "width=900,height=700,resizable,scrollbars"
    );

    // Poll until the window is ready and then send the hypercube
    const sendData = () => {
      if (popout && popout.document.readyState === "complete") {
        popout.postMessage({ type: "SET_HYPERCUBE", payload: hypercube }, "*");
      } else {
        setTimeout(sendData, 50);
      }
    };

    sendData();
  };

  return (
    <button
      onClick={openPopoutWindow}
      className="text-sm text-blue-600 hover:underline"
      title="Pop out"
    >
      Open in new window
    </button>
  );
};

export default PopOutButton;
