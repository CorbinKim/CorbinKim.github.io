import React from "react";
import {Routes, Route} from "react-router-dom";
import Home from "./home/Home";
import BlogPost from "./blog/BlogPost";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      {/* No standalone /blog index — the Writing section on the portfolio
          (see home/Writing.jsx, #writing) is the index; individual posts
          still get their own permalink here. */}
      <Route path="/blog/:slug" element={<BlogPost />} />
    </Routes>
  );
}

export default App;
