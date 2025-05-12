import React, { useEffect, useState } from "react";
import { Check } from "lucide-react";
import "./DropdownMenu.css";
// REMOVED: import { useReplacements } from "./ReplacementContext";

const CommentPopup = ({ message, onClose }) => (
  <div className="popup-overlay">
    <div className="popup-box custom-popup">
      <pre
        style={{
          maxHeight: "300px",
          overflowY: "auto",
          whiteSpace: "pre-wrap",
          textAlign: "left",
        }}
      >
        {message}
      </pre>
      <button className="popup-close custom-close" onClick={onClose}>
        Close
      </button>
    </div>
  </div>
);

export default function DropdownMenu() {
  const [nodeMap, setNodeMap] = useState({});
  const [childrenMap, setChildrenMap] = useState({});
  const [path, setPath] = useState([]);
  const [activatedMap, setActivatedMap] = useState({});
  const [clickedVisibleMap, setClickedVisibleMap] = useState({});
  const [showComment, setShowComment] = useState(null);
  const [debugData, setDebugData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // REMOVED: const { replacements } = useReplacements();

  // REMOVED: The replaceLabelText function
  // const replaceLabelText = (text) => {
  //   if (typeof text !== 'string') return '';
  //   let updated = text;
  //   Object.entries(replacements).forEach(([term, value]) => {
  //     if (value.trim() !== "") {
  //       const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  //       const pattern = new RegExp(`\\b${escapedTerm}\\b`, "gi");
  //       updated = updated.replace(pattern, value);
  //     }
  //   });
  //   return updated;
  // };

  useEffect(() => {
    async function fetchDataFromJson() {
      setIsLoading(true);
      try {
        const [possResponse, connsResponse] = await Promise.all([
          fetch("/possibilities.json"),
          fetch("/connections.json")
        ]);

        if (!possResponse.ok) {
          throw new Error(`Failed to fetch possibilities.json: ${possResponse.statusText} (status: ${possResponse.status})`);
        }
        if (!connsResponse.ok) {
          throw new Error(`Failed to fetch connections.json: ${connsResponse.statusText} (status: ${connsResponse.status})`);
        }

        const poss = await possResponse.json();
        const conns = await connsResponse.json();

        const nodeMapTemp = {};
        const childrenMapTemp = {};

        for (const node of poss) {
          nodeMapTemp[node.id] = {
            ...node,
            label: node.question,
          };
          childrenMapTemp[node.id] = [];
        }

        for (const conn of conns) {
          if (childrenMapTemp[conn.start_id] === undefined) {
            console.warn(`Connection found for non-existent start_id: ${conn.start_id}. Creating an empty children array.`);
            childrenMapTemp[conn.start_id] = [];
          }
          if (nodeMapTemp[conn.target_id] === undefined) {
              console.warn(`Connection target_id ${conn.target_id} does not exist in possibilities data.`);
          }
          childrenMapTemp[conn.start_id].push(conn.target_id);
        }

        setNodeMap(nodeMapTemp);
        setChildrenMap(childrenMapTemp);

        setDebugData({
          nodes: nodeMapTemp,
          connections: childrenMapTemp,
          rawPoss: poss,
          rawConns: conns,
        });

        const startNode = poss.find(p => p.id === 2);
if (startNode) {
  setPath([startNode.id]);
} else {
  console.warn("Start node with id === 1 not found. Falling back to default logic.");
  const targetIds = new Set(conns.map(c => c.target_id));
  const rootNode = poss.find(p => !targetIds.has(p.id));
  if (rootNode) {
    setPath([rootNode.id]);
  } else if (poss.length > 0) {
    setPath([poss[0].id]); // use first item as fallback
  } else {
    console.warn("Possibilities array is empty after fetching.");
  }
}

      } catch (err) {
        console.error("Error fetching or processing data from JSON:", err);
        setDebugData({ error: "JSON Fetch or processing failed", details: err.message, stack: err.stack });
      } finally {
        setIsLoading(false);
      }
    }

    fetchDataFromJson();
  }, []);

  const getCurrentItems = () => {
    if (isLoading || path.length === 0 || Object.keys(nodeMap).length === 0) {
      return [];
    }
    const currentId = path[path.length - 1];
    if (!childrenMap[currentId]) {
        console.warn(`No children found for currentId: ${currentId}. This might be a leaf node or data issue.`);
        return [];
    }
    const childrenIds = childrenMap[currentId] || [];
    const items = childrenIds.map((id) => nodeMap[id]).filter(Boolean);

    // UPDATED SORTING LOGIC:
    // Sort items based on their original 'is_visible' status and their original order.
    // This ensures that clicking an item to reveal it does not change its position in the list.
    const sortedItems = [...items].sort((a, b) => {
      // Primary sort criterion: original 'is_visible' status.
      // Items with is_visible: false (originally invisible) should come before is_visible: true.
      if (a.is_visible !== b.is_visible) {
        return a.is_visible ? 1 : -1; // If a.is_visible is true, it comes after b (if b.is_visible is false).
      }

      // Secondary sort criterion: original order from childrenIds.
      // This applies if both items have the same original 'is_visible' status.
      // It preserves their relative order as defined in connections.json.
      const indexA = childrenIds.indexOf(a.id);
      const indexB = childrenIds.indexOf(b.id);
      return indexA - indexB;
    });

    return sortedItems;
  };

  const handleActivate = (id, comment) => {
    setActivatedMap((prev) => ({ ...prev, [id]: true }));
    if (comment) setShowComment(comment);
  };

  const handleItemClick = (item, siblings) => {
    if (!item || !item.id) {
        console.error("handleItemClick received invalid item:", item);
        return;
    }
    if (!item.is_visible && !clickedVisibleMap[item.id]) {
      setClickedVisibleMap((prev) => ({ ...prev, [item.id]: true }));
      return;
    }

    if (!item.is_active && item.comment) {
      setShowComment(item.comment);
    }

    const anySiblingRequiresActivation = siblings.some(sibling => sibling.is_active);
    let allRequiredSiblingsActivated = true;

    if (anySiblingRequiresActivation) {
        allRequiredSiblingsActivated = siblings.every((sibling) => {
            return !sibling.is_active || sibling.id === item.id || activatedMap[sibling.id];
        });
    }

    if (item.is_active && !activatedMap[item.id]) {
      alert("Please activate this item before going deeper.");
    } else if (anySiblingRequiresActivation && !allRequiredSiblingsActivated) {
      alert("Please activate all items on this level before proceeding.");
    } else {
      const hasChildren = childrenMap[item.id] && childrenMap[item.id].length > 0;
      if (hasChildren) {
        if (item.is_active && activatedMap[item.id] && item.comment) {
          setShowComment(item.comment);
        }
        setPath([...path, item.id]);
      } else {
        console.log("No further options available for this item (leaf node).");
        if (item.comment && (!item.is_active || (item.is_active && activatedMap[item.id])) && showComment !== item.comment) {
           setShowComment(item.comment);
        }
      }
    }
  };

  const goBack = () => {
    if (path.length > 1) {
      setPath((prev) => prev.slice(0, -1));
    }
  };

  const currentItems = getCurrentItems();

  if (isLoading) {
    return (
      <div className="outer-wrapper">
        <div className="dropdown-wrapper">
          <div className="dropdown-card">
            <h1 className="dropdown-title">Leitfaden</h1>
            <p>Loading data...</p>
          </div>
          <img src="/RandoriPro.png" alt="Top" className="bottompng" />
        </div>
      </div>
    );
  }
  
  if (path.length === 0 && !isLoading && Object.keys(nodeMap).length === 0) {
    return (
        <div className="outer-wrapper">
            <div className="dropdown-wrapper">
                <div className="dropdown-card">
                    <h1 className="dropdown-title">Leitfaden</h1>
                    <p>No data loaded. Please ensure possibilities.json and connections.json are in the public folder and contain valid data. Check the console for errors.</p>
                    <button
                        className="debug-button"
                        onClick={() => setShowComment(JSON.stringify(debugData, null, 2))}
                        style={{marginTop: "1rem"}}
                    >
                        🐞 Show Debug Info
                    </button>
                </div>
                 <img src="/RandoriPro.png" alt="Top" className="bottompng" />
                 {showComment && (
                    <CommentPopup
                    message={showComment}
                    onClose={() => setShowComment(null)}
                    />
                )}
            </div>
        </div>
    );
  }

  if (path.length === 0 && !isLoading && Object.keys(nodeMap).length > 0) {
    return (
      <div className="outer-wrapper">
        <div className="dropdown-wrapper">
          <div className="dropdown-card">
            <h1 className="dropdown-title">Leitfaden</h1>
            <p>Initializing or no root node found to start. Check console & debug data.</p>
             <button
                className="debug-button"
                onClick={() => setShowComment(JSON.stringify(debugData, null, 2))}
                style={{marginTop: "1rem"}}
            >
                🐞 Show Debug Info
            </button>
          </div>
          <img src="/RandoriPro.png" alt="Top" className="bottompng" />
            {showComment && (
                <CommentPopup
                message={showComment}
                onClose={() => setShowComment(null)}
                />
            )}
        </div>
      </div>
    );
  }

  return (
    <div className="outer-wrapper">
      <div className="dropdown-wrapper">
        <div className="dropdown-card">
          <h1 className="dropdown-title">Leitfaden</h1>

          {path.length > 1 && (
            <button className="back-button" onClick={goBack}>
              ← Back
            </button>
          )}



          <div className="transition-container">
            <div className="transition-slide">
              {currentItems.map((item) => {
                if (!item || !item.id) {
                    console.warn("Rendering an invalid item:", item);
                    return null;
                }
                const isVisible = item.is_visible || clickedVisibleMap[item.id];
                // UPDATED: Use item.label directly
                const processedLabel = item.label || ''; // Ensure processedLabel is a string

                let itemSpecificClass = "";
                // Logic now uses the raw item.label
                if (processedLabel.includes("---") || processedLabel.toLowerCase().includes("nein")) {
                  itemSpecificClass = "dropdown-item-red";
                } else if (processedLabel.includes(":::") || processedLabel.includes("+++") || processedLabel.toLowerCase().startsWith("ja ")) {
                  itemSpecificClass = "dropdown-item-green";
                }

                return (
                  <div
                    key={item.id}
                    className={`dropdown-item ${isVisible ? "" : "blurred"} ${itemSpecificClass}`}
                    title={!isVisible ? "Click to reveal" : ""}
                  >
                    <button
                      className="dropdown-button"
                      onClick={() => handleItemClick(item, currentItems)}
                    >
                      {/* UPDATED: Display processedLabel (which is now item.label) */}
                      <span>{processedLabel}</span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                        }}
                      >
                        {item.is_active && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleActivate(item.id, item.comment);
                            }}
                            className="check-button"
                            style={{
                              width: "2rem",
                              height: "2rem",
                              border: "1px solid white",
                              borderRadius: "0.25rem",
                              backgroundColor: activatedMap[item.id]
                                ? "white"
                                : "transparent",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: activatedMap[item.id] ? "#991b1b" : "white",
                              cursor: "pointer",
                            }}
                          >
                            {activatedMap[item.id] && <Check size={14} />}
                          </button>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <img src="/RandoriPro.png" alt="Top" className="bottompng" />

        {showComment && (
          <CommentPopup
            message={showComment}
            onClose={() => setShowComment(null)}
          />
        )}
      </div>
    </div>
  );
}
