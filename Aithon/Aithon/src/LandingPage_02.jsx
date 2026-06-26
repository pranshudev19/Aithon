import React from "react";
import { motion } from "framer-motion";
import { ClipboardCheck, Database, BrainCircuit, FileSpreadsheet } from "lucide-react";

export default function AgentsPage() {
  const agents = [
    {
      name: "Task Planner Agent",
      icon: <ClipboardCheck className="w-12 h-12 text-indigo-500" />,
      desc: "Smartly distributes and monitors tasks within your organization. Automatically assigns work to the right people, notifies team members, and tracks progress using intelligent task workflows.",
    },
    {
      name: "Data Quality Governance Agent",
      icon: <Database className="w-12 h-12 text-blue-500" />,
      desc: "Ensures your enterprise data remains accurate, consistent, and compliant. Detects anomalies, cleans data pipelines, and maintains high-quality data flow across your systems.",
    },
    {
      name: "Synthetic Data Agent",
      icon: <BrainCircuit className="w-12 h-12 text-purple-500" />,
      desc: "Generates realistic yet privacy-preserving synthetic data for AI training and analytics, helping you scale experimentation while protecting sensitive information.",
    },
    {
      name: "Data Schema Contract Enforcer Agent",
      icon: <FileSpreadsheet className="w-12 h-12 text-green-500" />,
      desc: "Automatically validates and enforces data schema contracts across APIs and databases — ensuring every service communicates with integrity and precision.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 text-gray-900">
      {/* Header */}
      <header className="flex justify-between items-center px-8 py-4 shadow-sm bg-white sticky top-0 z-50">
        <h1 className="text-2xl font-bold text-indigo-600 tracking-tight">Aithon AI</h1>
        <nav className="hidden md:flex gap-6 font-medium text-gray-700">
          <a href="/" className="hover:text-indigo-600 transition-colors">Home</a>
          <a href="#about" className="hover:text-indigo-600 transition-colors">About</a>
          <a href="#agents" className="hover:text-indigo-600 transition-colors">Agents</a>
          <a href="#contact" className="hover:text-indigo-600 transition-colors">Contact</a>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="text-center py-20 bg-gradient-to-b from-indigo-50 to-white">
        <motion.h2
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="text-5xl font-extrabold text-gray-900"
        >
          Meet the <span className="text-indigo-600">Aithon AI Agents</span>
        </motion.h2>
        <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto">
          Each agent is designed to simplify, automate, and optimize your data-driven operations —  
          making enterprise workflows smarter, faster, and more reliable.
        </p>
      </section>

      {/* Agents Grid */}
      <section id="agents" className="px-8 py-20 max-w-6xl mx-auto grid md:grid-cols-2 gap-10">
        {agents.map((agent, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: index * 0.2 }}
            className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all hover:scale-[1.02] p-8 border border-gray-100"
          >
            <div className="flex flex-col items-center text-center">
              <div className="p-4 bg-indigo-50 rounded-full mb-6">{agent.icon}</div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-3">{agent.name}</h3>
              <p className="text-gray-600 leading-relaxed">{agent.desc}</p>
            </div>
          </motion.div>
        ))}
      </section>

      {/* About Section */}
      <section id="about" className="py-24 bg-gray-50 text-center px-8">
        <h3 className="text-4xl font-bold text-gray-900 mb-6">About Aithon AI</h3>
        <p className="max-w-3xl mx-auto text-lg text-gray-600 leading-relaxed">
          Aithon AI is a next-generation platform designed to revolutionize enterprise AI operations.  
          With intelligent agents that automate key processes — from data governance to workflow optimization —  
          we empower businesses to innovate with confidence and precision.
        </p>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-center">
        <h3 className="text-3xl font-bold mb-4">Get in Touch</h3>
        <p className="mb-8 text-lg opacity-90 max-w-2xl mx-auto">
          Want to learn how Aithon AI can transform your enterprise operations? Let’s connect.
        </p>
        <a
          href="mailto:info@aithon.ai"
          className="inline-block bg-white text-indigo-600 font-semibold px-8 py-3 rounded-xl shadow-md hover:scale-105 transition-transform"
        >
          Contact Us
        </a>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 text-center py-8">
        <p>© {new Date().getFullYear()} Aithon AI — Empowering Intelligent Enterprises.</p>
      </footer>
    </div>
  );
}