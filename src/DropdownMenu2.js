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

// Helper function for the auto-reveal logic
// This function is defined outside the component as it's pure and doesn't depend on component lifecycle/scope beyond its arguments.
const getAutoRevealState = (currentLevelItems, clickedMap, activeMap) => {
  let autoRevealCandidateId = null;
  let shouldApplySpecialSorting = false; // Flag to indicate if the special sorting should apply

  // Ensure currentLevelItems is an array and not empty before proceeding
  if (!Array.isArray(currentLevelItems) || currentLevelItems.length === 0) {
    return { autoRevealCandidateId, shouldApplySpecialSorting };
  }

  const effectivelyInvisibleItems = currentLevelItems.filter(
    (item) => item && !item.is_visible && !clickedMap[item.id] // Added item check
  );

  if (effectivelyInvisibleItems.length === 1) {
    const candidate = effectivelyInvisibleItems[0];
    const otherSiblings = currentLevelItems.filter(
      (item) => item && item.id !== candidate.id // Added item check
    );

    // Condition:
    // 1. All other siblings must have `is_active: true`.
    // 2. All other siblings (which are `is_active: true`) must be activated (in `activeMap`).
    // If there are no other siblings, this condition is vacuously true, meaning a single
    // invisible item will auto-reveal if it's the only child.
    const allOtherSiblingsConditionsMet = otherSiblings.every(
      (sib) => sib.is_active && activeMap[sib.id]
    );

    if (allOtherSiblingsConditionsMet) {
      autoRevealCandidateId = candidate.id;
      shouldApplySpecialSorting = true; // Signal that sorting should be affected
    }
  }
  return { autoRevealCandidateId, shouldApplySpecialSorting };
};


export default function DropdownMenu() {
  const [nodeMap, setNodeMap] = useState({});
  const [childrenMap, setChildrenMap] = useState({});
  const [path, setPath] = useState([]);
  const [activatedMap, setActivatedMap] = useState({});
  const [clickedVisibleMap, setClickedVisibleMap] = useState({});
  const [showComment, setShowComment] = useState(null);
  const [debugData, setDebugData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

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
          console.warn("Start node with id === 2 not found. Falling back to default logic.");
          const targetIds = new Set(conns.map(c => c.target_id));
          const rootNode = poss.find(p => !targetIds.has(p.id));
          if (rootNode) {
            setPath([rootNode.id]);
          } else if (poss.length > 0) {
            setPath([poss[0].id]); 
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

  // useEffect for auto-revealing single invisible child when conditions are met
  useEffect(() => {
    if (isLoading || path.length === 0 || Object.keys(nodeMap).length === 0 || Object.keys(childrenMap).length === 0) {
      return;
    }
    const currentId = path[path.length - 1];
    if (!childrenMap[currentId]) {
      return;
    }
    const currentChildrenIds = childrenMap[currentId] || [];
    const currentLevelItems = currentChildrenIds.map((id) => nodeMap[id]).filter(Boolean);

    const { autoRevealCandidateId, shouldApplySpecialSorting } = getAutoRevealState(
      currentLevelItems,
      clickedVisibleMap,
      activatedMap
    );

    if (shouldApplySpecialSorting && autoRevealCandidateId && !clickedVisibleMap[autoRevealCandidateId]) {
      setClickedVisibleMap((prev) => ({ ...prev, [autoRevealCandidateId]: true }));
    }
  }, [isLoading, path, nodeMap, childrenMap, clickedVisibleMap, activatedMap]);


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

    // Determine if the special auto-reveal condition is currently met for sorting
    const { 
      autoRevealCandidateId: currentAutoRevealId, 
      shouldApplySpecialSorting: currentShouldApplySpecialSorting 
    } = getAutoRevealState(items, clickedVisibleMap, activatedMap);

    const sortedItems = [...items].sort((a, b) => {
      // Ensure a and b are valid items before accessing properties
      if (!a || !a.id) return 1; // push null/undefined 'a' to the end
      if (!b || !b.id) return -1; // push null/undefined 'b' to the end (keep 'a' before)


      const isATheSpecialItem = currentShouldApplySpecialSorting && a.id === currentAutoRevealId;
      const isBTheSpecialItem = currentShouldApplySpecialSorting && b.id === currentAutoRevealId;

      if (isATheSpecialItem) return 1; // Special item 'a' goes to the end
      if (isBTheSpecialItem) return -1; // Special item 'b' goes to the end (so 'a' comes before)

      // Regular sorting for all other items:
      // Items that are still effectively hidden (original is_visible:false AND not in clickedVisibleMap) come first.
      const aIsEffectivelyHidden = !a.is_visible && !clickedVisibleMap[a.id];
      const bIsEffectivelyHidden = !b.is_visible && !clickedVisibleMap[b.id];

      if (aIsEffectivelyHidden !== bIsEffectivelyHidden) {
        return aIsEffectivelyHidden ? -1 : 1; // Effectively hidden items come before effectively visible ones.
      }

      // If both have the same effective hidden status (e.g., both hidden, or both visible),
      // sort by their original order from connections.json.
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

    const anySiblingRequiresActivation = siblings.some(sibling => sibling && sibling.is_active);
    let allRequiredSiblingsActivated = true;

    if (anySiblingRequiresActivation) {
        allRequiredSiblingsActivated = siblings.every((sibling) => {
            if (!sibling) return true; // Skip if sibling is undefined/null
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
                const processedLabel = item.label || ''; 

                let itemSpecificClass = "";
                // UPDATED: Added yellow condition, checking it first.
                if (processedLabel.includes("///")) {
                  itemSpecificClass = "dropdown-item-yellow";
                } else if (processedLabel.includes("---") || processedLabel.toLowerCase().includes("nein")) {
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
                              color: activatedMap[item.id] ? "#991b1b" : "white", // This color might need to adapt based on itemSpecificClass for better contrast
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
