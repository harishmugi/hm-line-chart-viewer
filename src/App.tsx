import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './index.css'
import Chart from './components/Chart'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <Chart/>
    </>
  )
}

export default App
