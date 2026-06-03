import { createContext, use, useMemo, useState } from 'react';

type SidebarContextType = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

const SidebarContext = createContext<SidebarContextType>({
  open: false,
  setOpen: () => {},
});

export const SidebarProvider = ({ children }: { children: React.ReactNode }) => {
  const [open, setOpen] = useState(false);
  const value = useMemo(() => ({ open, setOpen }), [open]);
  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => use(SidebarContext);