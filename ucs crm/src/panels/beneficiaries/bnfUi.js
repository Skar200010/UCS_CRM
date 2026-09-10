import { createContext, useContext } from 'react'

export const BnfBaseContext = createContext('/beneficiaries')
export const BnfBaseProvider = BnfBaseContext.Provider
export const useBnfBase = () => useContext(BnfBaseContext)