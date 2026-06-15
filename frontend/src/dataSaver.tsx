import React, {
  createContext,
  use,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { getSavedDataSaver, saveDataSaver } from './preferences';

type DataSaverContextType = {
  dataSaver: boolean;
  setDataSaver: (enabled: boolean) => Promise<void>;
};

const DataSaverContext = createContext<DataSaverContextType | undefined>(undefined);

// Start loading immediately when the module is imported, not when the component mounts.
// use() below suspends instead of rendering with a placeholder, eliminating the extra render.
const _savedDataSaverProm = getSavedDataSaver().catch(() => false);

export const DataSaverProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const initialDataSaver = use(_savedDataSaverProm);
  const [dataSaver, setDataSaverState] = useState<boolean>(initialDataSaver);

  const setDataSaver = useCallback(async (enabled: boolean) => {
    await saveDataSaver(enabled);
    setDataSaverState(enabled);
  }, []);

  const value = useMemo(
    () => ({
      dataSaver,
      setDataSaver,
    }),
    [dataSaver, setDataSaver]
  );

  return (
    <DataSaverContext.Provider value={value}>
      {children}
    </DataSaverContext.Provider>
  );
};

export const useDataSaver = () => {
  const context = use(DataSaverContext);

  if (!context) {
    throw new Error('useDataSaver debe usarse dentro de DataSaverProvider');
  }

  return context;
};
