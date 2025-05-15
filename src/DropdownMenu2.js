import React, { useEffect, useState, useCallback } from "react";
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

// Updated getAutoRevealState
const getAutoRevealState = (currentLevelItems, activeMap) => {
  let autoRevealCandidateId = null;
  let shouldApplySpecialSorting = false;

  if (!Array.isArray(currentLevelItems) || currentLevelItems.length === 0) {
    return { autoRevealCandidateId, shouldApplySpecialSorting };
  }

  // Find items that are *initially* invisible based on their properties (item.is_visible === false).
  // This check does not consider whether an item has been clicked (clickedMap is not used here).
  const initiallyInvisibleItems = currentLevelItems.filter(
    (item) => item && !item.is_visible
  );

  // The special auto-reveal rule applies ONLY if there was *exactly one* initially invisible item.
  if (initiallyInvisibleItems.length === 1) {
    const candidate = initiallyInvisibleItems[0];
    const otherSiblings = currentLevelItems.filter(
      (item) => item && item.id !== candidate.id
    );

    // Check if all other siblings that *require* activation are indeed activated.
    const allOtherSiblingsConditionsMet = otherSiblings.every((sib) => {
      if (!sib) return true;
      // If a sibling is_active (requires a checkmark), it must be present in the activeMap.
      if (sib.is_active === true) {
        return !!activeMap[sib.id];
      }
      // If a sibling does not require activation, it doesn't block.
      return true;
    });

    if (allOtherSiblingsConditionsMet) {
      autoRevealCandidateId = candidate.id;
      shouldApplySpecialSorting = true; // This flag indicates the item should be visually distinct or sorted specially
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
  const [bottomImageOpacity, setBottomImageOpacity] = useState(0.3);


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

  useEffect(() => {
    // Reset specialAutoRevealedItemId when the path changes (i.e., new level loaded)
    setSpecialAutoRevealedItemId(null);
  }, [path]);

  useEffect(() => {
    // This effect handles the initial auto-reveal logic for a level.
    if (isLoading || path.length === 0 || Object.keys(nodeMap).length === 0 || Object.keys(childrenMap).length === 0) {
      return;
    }
    const currentId = path[path.length - 1];
    if (!childrenMap[currentId]) return;

    const currentChildrenIds = childrenMap[currentId] || [];
    const currentLevelItems = currentChildrenIds.map((id) => nodeMap[id]).filter(Boolean);

    // getAutoRevealState now only depends on initial visibility and activeMap for sibling checks.
    const { autoRevealCandidateId, shouldApplySpecialSorting } = getAutoRevealState(
      currentLevelItems,
      activatedMap
    );

    if (shouldApplySpecialSorting && autoRevealCandidateId) {
      // Only auto-reveal (mark as clicked) and set as special if it hasn't been clicked/revealed yet
      // AND it's not already the special item for this level (prevents re-setting if effect re-runs).
      if (!clickedVisibleMap[autoRevealCandidateId] && autoRevealCandidateId !== specialAutoRevealedItemId) {
        setClickedVisibleMap((prev) => ({ ...prev, [autoRevealCandidateId]: true }));
        setSpecialAutoRevealedItemId(autoRevealCandidateId);
      }
    }
    // Dependencies:
    // - isLoading, path, nodeMap, childrenMap: Define the current level's items.
    // - activatedMap: Checked by getAutoRevealState for sibling conditions.
    // - clickedVisibleMap: Checked to prevent re-revealing an already clicked item.
    // - specialAutoRevealedItemId: Checked to prevent re-setting if it's already the special item.
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

    // `specialAutoRevealedItemId` is the ID of the item (if any) that was
    // auto-revealed at the start of this level because it was the sole initially invisible item.
    const sortedItems = [...items].sort((a, b) => {
      if (!a || !a.id) return 1;
      if (!b || !b.id) return -1;

      const aIsTheSpecialAutoRevealedItem = specialAutoRevealedItemId && a.id === specialAutoRevealedItemId;
      const bIsTheSpecialAutoRevealedItem = specialAutoRevealedItemId && b.id === specialAutoRevealedItemId;

      // If specialAutoRevealedItemId is set, the item with that ID goes to the bottom.
      if (specialAutoRevealedItemId) {
          if (aIsTheSpecialAutoRevealedItem && !bIsTheSpecialAutoRevealedItem) return 1; // 'a' (special) goes after 'b'
          if (!aIsTheSpecialAutoRevealedItem && bIsTheSpecialAutoRevealedItem) return -1; // 'b' (special) goes after 'a'
      }

      // For all other items, or if there's no special item, maintain the original order.
      const indexA = childrenIds.indexOf(a.id);
      const indexB = childrenIds.indexOf(b.id);
      return indexA - indexB;
    });

    return sortedItems;
  }, [isLoading, path, nodeMap, childrenMap, specialAutoRevealedItemId]); // Dependencies for sorting


  const handleActivate = (id, comment) => {
    setActivatedMap((prev) => ({ ...prev, [id]: true }));
    if (comment) setShowComment(comment);
  };

  const handleItemClick = (item, siblings) => {
    if (!item || !item.id) {
        console.error("handleItemClick received invalid item:", item);
        return;
    }

    if (item.id === 5) {
      setBottomImageOpacity(1);
    }

    // If the item is not visible (based on its original prop) and hasn't been clicked yet,
    // mark it as clicked to reveal it. Then return, as the primary action is revealing.
    if (!item.is_visible && !clickedVisibleMap[item.id]) {
      setClickedVisibleMap((prev) => ({ ...prev, [item.id]: true }));
      return; // Action done (reveal), no further processing for this click.
    }

    // If item is not active (doesn't require a checkmark) but has a comment, show it.
    if (!item.is_active && item.comment) {
      setShowComment(item.comment);
    }

    const anySiblingRequiresActivation = siblings.some(sibling => sibling && sibling.is_active);
    let allRequiredSiblingsActivated = true;

    if (anySiblingRequiresActivation) {
        allRequiredSiblingsActivated = siblings.every((sibling) => {
            if (!sibling) return true;
            // A sibling blocks progression if it's 'is_active' AND not yet in 'activatedMap'
            // UNLESS it's the item currently being clicked.
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
        // If item is active, activated, and has a comment, ensure comment is shown before navigating.
        if (item.is_active && activatedMap[item.id] && item.comment && showComment !== item.comment) {
          setShowComment(item.comment);
        }
        setPath([...path, item.id]);
      } else { // Leaf node
        console.log("No further options available for this item (leaf node).");
        // Show comment for leaf node if applicable (and not already shown)
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
          <img src="/RandoriPro.png" alt="Top" className="bottompng" style={{ opacity: bottomImageOpacity }} />
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
                 <img src="/RandoriPro.png" alt="Top" className="bottompng" style={{ opacity: bottomImageOpacity }} />
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
          </div>
          <img src="/RandoriPro.png" alt="Top" className="bottompng" style={{ opacity: bottomImageOpacity }} />
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
                // An item is effectively visible if its original 'is_visible' prop is true,
                // OR if it has been clicked (its ID is in clickedVisibleMap).
                const isEffectivelyVisible = item.is_visible || clickedVisibleMap[item.id];
                const processedLabel = item.label || '';

                let itemSpecificClass = "";
                if (processedLabel.includes("///")) {
                  itemSpecificClass = "dropdown-item-yellow";
                } else if (processedLabel.includes("---") || processedLabel.toLowerCase().includes("nein")) {
                  itemSpecificClass = "dropdown-item-red";
                } else if (processedLabel.includes(":::") || processedLabel.includes("+++") || processedLabel.toLowerCase().startsWith("ja ")) {
                  itemSpecificClass = "dropdown-item-green";
                }

                let labelContent;
                if (processedLabel.includes(";")) {
                  const parts = processedLabel.split(";", 2);
                  const beforeSemicolon = parts[0];
                  const afterSemicolon = parts.length > 1 ? parts[1] : "";
                  labelContent = (
                    <>
                      <span style={{ color: "aqua" }}>{beforeSemicolon}</span>
                      {`;${afterSemicolon}`}
                    </>
                  );
                } else {
                  labelContent = processedLabel;
                }

                return (
                  <div
                    key={item.id}
                    className={`dropdown-item ${isEffectivelyVisible ? "" : "blurred"} ${itemSpecificClass}`}
                    title={!isEffectivelyVisible ? "Click to reveal" : ""}
                  >
                    <button
                      className="dropdown-button"
                      onClick={() => handleItemClick(item, currentItems)}
                    >
                      <span>{labelContent}</span>
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
                              color: activatedMap[item.id] ? (itemSpecificClass === "dropdown-item-yellow" ? "#4E342E" : "#991b1b") : "white",
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
        <img src="/RandoriPro.png" alt="Top" className="bottompng" style={{ opacity: bottomImageOpacity }}/>

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
