import React from 'react';
import { Outlet } from 'react-router-dom';

export const AppShell: React.FC = () => {
  return <Outlet />;
};

export default AppShell;

