import { useEffect, useState } from 'react'

export default function App() {
  const [message, setMessage] = useState('Đang tải...')

  useEffect(() => {
    fetch('http://localhost:8080/api/hello')
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch(() => setMessage('Không kết nối được backend'))
  }, [])

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>BeefCare</h1>
      <p>{message}</p>
    </div>
  )
}
