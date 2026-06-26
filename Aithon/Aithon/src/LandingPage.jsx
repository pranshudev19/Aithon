// LandingPage.jsx
import React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Brain, LineChart, ShieldCheck, Users } from "lucide-react";
import { Link, useNavigate } from "react-router-dom"; // ✅ added useNavigate

export default function LandingPage() {
  const navigate = useNavigate(); // ✅ hook for routing

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900">
      {/* Navbar */}
      <header className="flex justify-between items-center p-6 bg-white shadow-md sticky top-0 z-50">
        <h1 className="text-2xl font-bold text-indigo-600">AIthon</h1>
        <nav className="space-x-6 hidden md:flex">
          <a href="#solutions" className="hover:text-indigo-600 transition">
            Solutions
          </a>
          <a href="#industries" className="hover:text-indigo-600 transition">
            Industries
          </a>
          <a href="#platform" className="hover:text-indigo-600 transition">
            Our Platform
          </a>
          <a href="#contact" className="hover:text-indigo-600 transition">
            Contact
          </a>
        </nav>
        <div className="flex gap-3">
          <Link
            to="/login"
            className="px-4 py-2 bg-white border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition"
          >
            Login
          </Link>
          <Link
            to="/signup"
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="flex flex-col md:flex-row items-center justify-between px-8 md:px-20 py-24 bg-gradient-to-r from-indigo-100 to-white">
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="md:w-full text-center"
        >
          <h2 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
            AI Agents to{" "}
            <span className="text-indigo-600">Automate Your Workflows</span>
          </h2>
          <p className="text-lg md:text-xl text-gray-700 mb-8">
            Assign tasks, send alerts, and generate insights automatically with intelligent AI agents tailored for your business.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              to="/signup"
              className="inline-flex items-center bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
            >
              Try for Free <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
            <Link
              to="#platform"
              className="inline-flex items-center bg-white border-2 border-indigo-600 text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-indigo-50 transition"
            >
              Watch Demo
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Solutions Section */}
      <section id="solutions" className="py-24 px-8 md:px-20 bg-white">
        <h3 className="text-4xl font-bold text-center mb-12">Our Solutions</h3>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              icon: <Brain className="w-12 h-12 text-indigo-600" />,
              title: "AI Agents",
              desc: "Intelligent agents that handle planning, task assignment, and decision-making.",
              route: "/landing2", // ✅ navigate here on click
            },
            {
              icon: <LineChart className="w-12 h-12 text-indigo-600" />,
              title: "Analytics",
              desc: "Real-time dashboards and predictive analytics to stay ahead of competition.",
            },
            {
              icon: <ShieldCheck className="w-12 h-12 text-indigo-600" />,
              title: "Security",
              desc: "Enterprise-grade security with role-based access and compliance standards.",
            },
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: i * 0.2 }}
              onClick={() => s.route && navigate(s.route)} // ✅ click handler
              className={`p-8 bg-gray-50 rounded-2xl shadow-md hover:shadow-xl hover:scale-105 transition ${
                s.route ? "cursor-pointer" : ""
              }`}
            >
              <div className="flex justify-center">{s.icon}</div>
              <h4 className="text-xl font-semibold mt-4 text-center">
                {s.title}
              </h4>
              <p className="text-gray-600 mt-2 text-center">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Industries Section */}
      <section id="industries" className="py-24 px-8 md:px-20 bg-gray-50">
        <h3 className="text-4xl font-bold text-center mb-12">
          Industries We Serve
        </h3>
        <div className="grid md:grid-cols-4 gap-8 text-center">
          {[
            { name: "Healthcare", desc: "Smart AI solutions for hospitals and clinics." },
            { name: "Finance", desc: "Automate processes and gain insights." },
            { name: "Education", desc: "Enhance learning and administration with AI." },
            { name: "Retail", desc: "Optimize inventory, sales, and customer experience." },
          ].map((ind, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.2 }}
              className="bg-gradient-to-tr from-indigo-50 to-white rounded-2xl p-6 shadow hover:shadow-lg transition"
            >
              <Users className="w-10 h-10 mx-auto text-indigo-600 mb-3" />
              <h4 className="text-lg font-semibold">{ind.name}</h4>
              <p className="text-gray-600 mt-1 text-sm">{ind.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Our Platform Section */}
      <section id="platform" className="py-24 px-8 md:px-20 bg-white">
        <h3 className="text-4xl font-bold text-center mb-12">Our Platform</h3>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto text-gray-700 text-lg space-y-6"
        >
          <p>
            Aithon AI is designed as an intelligent data governance platform that addresses the challenges of poor data quality, inconsistent schemas, and unreliable datasets in analytics and machine learning workflows.
          </p>
          <p>The system introduces autonomous agents that:</p>
          <ul className="list-disc list-inside space-y-2">
            <li>✅ Validate datasets</li>
            <li>✅ Enforce schema contracts</li>
            <li>✅ Generate synthetic data for safe testing</li>
            <li>✅ Plan tasks based on user intent</li>
          </ul>
          <p>
            By ensuring accuracy, consistency, and compliance, Aithon AI minimizes pipeline failures, reduces manual intervention, and enables organizations to make more reliable, data-driven decisions.
          </p>
        </motion.div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 px-8 md:px-20 bg-gray-50 text-center">
        <h3 className="text-4xl font-bold mb-6">Get in Touch</h3>
        <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
          Have questions or want a demo? Reach out to us and discover how AIthon can transform your workflows.
        </p>
        <Link
          to="/signup"
          className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          Contact Us
        </Link>
      </section>

      {/* Footer */}
      <footer className="py-6 bg-white text-center text-gray-500 border-t">
        © {new Date().getFullYear()} AIthon. All rights reserved.
      </footer>
    </div>
  );
}
