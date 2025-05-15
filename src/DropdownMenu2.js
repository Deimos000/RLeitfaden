import React, { useEffect, useState, useCallback } from "react"; // Added useCallback
import { Check } from "lucide-react";
import "./DropdownMenu.css";

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

// Placed outside to ensure it's not recreated on every render unnecessarily
// and to make its dependencies clear if it were memoized (though not strictly needed here as it's pure).
const getAutoRevealState = (currentLevelItems, clickedMap, activeMap) => {
  let autoRevealCandidateId = null;
  let shouldApplySpecialSorting = false;

  if (!Array.isArray(currentLevelItems) || currentLevelItems.length === 0) {
    return { autoRevealCandidateId, shouldApplySpecialSorting };
  }

  const effectivelyInvisibleItems = currentLevelItems.filter(
    (item) => item && !item.is_visible && !clickedMap[item.id]
  );

  if (effectivelyInvisibleItems.length === 1) {
    const candidate = effectivelyInvisibleItems[0];
    const otherSiblings = currentLevelItems.filter(
      (item) => item && item.id !== candidate.id
    );

    const allOtherSiblingsConditionsMet = otherSiblings.every((sib) => {
      if (!sib) return true; // Should be filtered by .filter(Boolean) earlier
      if (sib.is_active === true) { // If this sibling IS activatable
        return !!activeMap[sib.id]; // Then it MUST be activated
      }
      return true; // Otherwise (not activatable), it doesn't block.
    });

    if (allOtherSiblingsConditionsMet) {
      autoRevealCandidateId = candidate.id;
      shouldApplySpecialSorting = true;
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
  const [specialAutoRevealedItemId, setSpecialAutoRevealedItemId] = useState(null);


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

  // Reset special auto-revealed item when navigating
  useEffect(() => {
    setSpecialAutoRevealedItemId(null);
  }, [path]);

  // Effect for triggering auto-reveal and setting the special item ID
  useEffect(() => {
    if (isLoading || path.length === 0 || Object.keys(nodeMap).length === 0 || Object.keys(childrenMap).length === 0) {
      return;
    }
    const currentId = path[path.length - 1];
    if (!childrenMap[currentId]) return;

    const currentChildrenIds = childrenMap[currentId] || [];
    const currentLevelItems = currentChildrenIds.map((id) => nodeMap[id]).filter(Boolean);

    const { autoRevealCandidateId, shouldApplySpecialSorting } = getAutoRevealState(
      currentLevelItems,
      clickedVisibleMap,
      activatedMap
    );

    if (shouldApplySpecialSorting && autoRevealCandidateId) {
      if (!clickedVisibleMap[autoRevealCandidateId]) {
        setClickedVisibleMap((prev) => ({ ...prev, [autoRevealCandidateId]: true }));
      }
      // Set this item as special for the current level, if not already set
      if (autoRevealCandidateId !== specialAutoRevealedItemId) {
        setSpecialAutoRevealedItemId(autoRevealCandidateId);
      }
    }
  }, [isLoading, path, nodeMap, childrenMap, clickedVisibleMap, activatedMap, specialAutoRevealedItemId]);


  const getCurrentItems = useCallback(() => {
    if (isLoading || path.length === 0 || Object.keys(nodeMap).length === 0) {
      return [];
    }
    const currentId = path[path.length - 1];
    if (!childrenMap[currentId]) {
      return [];
    }
    const childrenIds = childrenMap[currentId] || [];
    const items = childrenIds.map((id) => nodeMap[id]).filter(Boolean);

    // Determine if an item *should* be auto-revealed in this render pass
    // This helps position it correctly immediately, avoiding a flash.
    const { 
      autoRevealCandidateId: currentPassCandidateId, 
      shouldApplySpecialSorting: currentPassShouldApply 
    } = getAutoRevealState(items, clickedVisibleMap, activatedMap);

    // The item that should be treated as "special and last" for sorting purposes:
    // Prioritize an already set specialAutoRevealedItemId for persistence,
    // otherwise, use the candidate from the current pass if applicable.
    const effectiveSpecialId = specialAutoRevealedItemId || (currentPassShouldApply ? currentPassCandidateId : null);

    const sortedItems = [...items].sort((a, b) => {
      if (!a || !a.id) return 1;
      if (!b || !b.id) return -1;

      const aIsSpecial = effectiveSpecialId && a.id === effectiveSpecialId;
      const bIsSpecial = effectiveSpecialId && b.id === effectiveSpecialId;

      if (aIsSpecial && !bIsSpecial) return 1; // Special 'a' goes after non-special 'b'
      if (!aIsSpecial && bIsSpecial) return -1; // Special 'b' goes after non-special 'a'

      // If both are special (not possible for single special) or neither are, use normal sort:
      const aIsEffectivelyHidden = !a.is_visible && !clickedVisibleMap[a.id];
      const bIsEffectivelyHidden = !b.is_visible && !clickedVisibleMap[b.id];

      if (aIsEffectivelyHidden !== bIsEffectivelyHidden) {
        return aIsEffectivelyHidden ? -1 : 1; // Effectively hidden items come first
      }

      const indexA = childrenIds.indexOf(a.id);
      const indexB = childrenIds.indexOf(b.id);
      return indexA - indexB; // Then sort by original order
    });

    return sortedItems;
  }, [isLoading, path, nodeMap, childrenMap, clickedVisibleMap, activatedMap, specialAutoRevealedItemId]);


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
      // If this click makes it eligible for auto-reveal of another, the effect will handle it.
      return;
    }

    if (!item.is_active && item.comment) {
      setShowComment(item.comment);
    }

    const anySiblingRequiresActivation = siblings.some(sibling => sibling && sibling.is_active);
    let allRequiredSiblingsActivated = true;

    if (anySiblingRequiresActivation) {
        allRequiredSiblingsActivated = siblings.every((sibling) => {
            if (!sibling) return true; 
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

  const currentItems = getCurrentItems(); // getCurrentItems is now memoized with useCallback

  // ... (Loading and error states remain the same) ...
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
                // An item is visible if it's originally visible OR it has been clicked/auto-revealed
                const isEffectivelyVisible = item.is_visible || clickedVisibleMap[item.id];
                const processedLabel = item.label || ''; 

                let itemSpecificClass = "";
                // Yellow marking for "///"
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
                    // Item is blurred if it's NOT effectively visible
                    className={`dropdown-item ${isEffectivelyVisible ? "" : "blurred"} ${itemSpecificClass}`}
                    title={!isEffectivelyVisible ? "Click to reveal" : ""}
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
                              color: activatedMap[item.id] ? (itemSpecificClass === "dropdown-item-yellow" ? "#4E342E" : "#991b1b") : "white", // Adapting check color for yellow
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
