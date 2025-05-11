import React, { createContext, useContext, useState } from "react";

const defaultTerms = {
  "[Ii]hr [Kk]ind": "",
  "Elternteil 1": "",
  "Elternteil 2": "",
};

const ReplacementContext = createContext();

export const ReplacementProvider = ({ children }) => {
  const [replacements, setReplacements] = useState(defaultTerms);
  return (
    <ReplacementContext.Provider value={{ replacements, setReplacements }}>
      {children}
    </ReplacementContext.Provider>
  );
};

export const useReplacements = () => useContext(ReplacementContext);
