import { createContext, useContext, useState } from 'react';

const MockModeContext = createContext({ useMock: true, setUseMock: () => {} });

export function MockModeProvider({ children }) {
  const [useMock, setUseMock] = useState(true);
  return (
    <MockModeContext.Provider value={{ useMock, setUseMock }}>
      {children}
    </MockModeContext.Provider>
  );
}

export function useMockMode() {
  return useContext(MockModeContext);
}

