import React from "react";
import {Routes, Route} from "react-router-dom";
import Home from "./home/Home";
import BlogList from "./blog/BlogList";
import BlogPost from "./blog/BlogPost";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/blog" element={<BlogList />} />
      <Route path="/blog/:slug" element={<BlogPost />} />
    </Routes>
  );
}

export default App;
