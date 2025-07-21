import { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  params: {
    locale: string;
  };
};

export default function LocalizedLayout({ children }: Props) {
  return <>{children}</>;
}
