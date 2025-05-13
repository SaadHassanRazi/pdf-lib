import React, { useState, useRef, useEffect } from "react";
import {
  Save,
  Image,
  Type,
  Download,
  Plus,
  Trash2,
  Move,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Camera,
} from "lucide-react";
import * as _ from "lodash";
import { Rnd } from "react-rnd";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// Mock PDF generation functionality (using jsPDF in actual implementation)
// In real scenario, you would import jsPDF and pdf-lib as needed
const mockPdfLib = {
  generatePdf: (content) => {
    console.log("Generating PDF with content:", content);
    // In a real implementation, this would use jsPDF to create a PDF
    const blob = new Blob(["PDF data"], { type: "application/pdf" });
    return URL.createObjectURL(blob);
  },
};

// PDF Editor Component
export default function PDFEditor() {
  const imageUploadRef = useRef(null);
  const [uploadingImageId, setUploadingImageId] = useState(null);

  // State for managing PDF content
  const [elements, setElements] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 595, height: 842 }); // A4 size in pixels
  const canvasRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [textOptions, setTextOptions] = useState({
    fontSize: 16,
    fontFamily: "Arial",
    bold: false,
    italic: false,
    align: "left",
  });

  // Function to add a new text element
  const addTextElement = () => {
    const padding = 100; // Safe margin
    const newX = Math.min(canvasSize.width - padding, 100);
    const newY = Math.min(canvasSize.height - padding, 100);

    const newElement = {
      id: Date.now(),
      type: "text",
      placeholder: "Write text here...",
      x: newX,
      y: newY,
      fontSize: textOptions.fontSize,
      fontFamily: textOptions.fontFamily,
      bold: textOptions.bold,
      italic: textOptions.italic,
      align: textOptions.align,
    };
    setElements([...elements, newElement]);
    setSelectedElement(newElement.id);
  };

  // Function to add an image element
  const addImageElement = () => {
    // In a real app, this would open a file picker
    const newElement = {
      id: Date.now(),
      type: "image",
      src: "null",
      x: 100,
      y: 100,
      width: 200,
      height: 150,
    };
    setElements([...elements, newElement]);
    setSelectedElement(newElement.id);
  };
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file && uploadingImageId) {
      const reader = new FileReader();
      reader.onload = (event) => {
        updateElement(uploadingImageId, { src: event.target.result });
      };
      reader.readAsDataURL(file);
    }
  };

  // Function to handle element updates
  const updateElement = (id, updates) => {
    setElements(
      elements.map((el) => (el.id === id ? { ...el, ...updates } : el))
    );
  };

  // Function to delete the selected element
  const deleteElement = () => {
    if (selectedElement) {
      setElements(elements.filter((el) => el.id !== selectedElement));
      setSelectedElement(null);
    }
  };

  // Handle mousedown on element
  const handleElementMouseDown = (e, id) => {
    e.stopPropagation();
    setSelectedElement(id);
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  // Handle mousedown on canvas (deselect)
  const handleCanvasMouseDown = () => {
    setSelectedElement(null);
  };

  // Handle text content change
  const handleTextChange = (id, content) => {
    updateElement(id, { content });
  };

  // Handle mouse move for dragging
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging && selectedElement) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;

        const element = elements.find((el) => el.id === selectedElement);
        if (element) {
          updateElement(selectedElement, {
            x: element.x + dx,
            y: element.y + dy,
          });
          setDragStart({ x: e.clientX, y: e.clientY });
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragStart, selectedElement, elements]);

  // Handle export to PDF
  const exportToPDF = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const canvasImage = await html2canvas(canvas);
      const imgData = canvasImage.toDataURL("image/png");

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [canvasSize.width, canvasSize.height],
      });

      pdf.addImage(imgData, "PNG", 0, 0);
      pdf.save("document.pdf");
    } catch (err) {
      console.error("PDF generation error:", err);
    }

    // Create a download link
    const link = document.createElement("a");
    link.href = pdfUrl;
    link.download = "document.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Toolbar */}
      <div className="bg-white shadow p-4 flex items-center space-x-4">
        <h1 className="text-xl font-bold flex-1">PDF Editor</h1>

        {/* Add Elements */}
        <div className="flex items-center space-x-2">
          <button
            onClick={addTextElement}
            className="p-2 bg-blue-500 text-white rounded flex items-center"
          >
            <Type size={16} className="mr-1" /> Add Text
          </button>
          <button
            onClick={addImageElement}
            className="p-2 bg-green-500 text-white rounded flex items-center"
          >
            <Image size={16} className="mr-1" /> Add Image
          </button>
          {selectedElement && (
            <button
              onClick={deleteElement}
              className="p-2 bg-red-500 text-white rounded flex items-center"
            >
              <Trash2 size={16} className="mr-1" /> Delete
            </button>
          )}
        </div>

        {/* Export */}
        <button
          onClick={exportToPDF}
          className="p-2 bg-purple-600 text-white rounded flex items-center"
        >
          <Download size={16} className="mr-1" /> Export PDF
        </button>
      </div>
      <input
        type="file"
        accept="image/*"
        ref={imageUploadRef}
        style={{ display: "none" }}
        onChange={handleImageUpload}
      />

      {/* Text Formatting Toolbar - Only visible when a text element is selected */}
      {selectedElement &&
        elements.find((el) => el.id === selectedElement)?.type === "text" && (
          <div className="bg-gray-200 p-2 flex items-center space-x-4">
            <select
              value={textOptions.fontFamily}
              onChange={(e) => {
                setTextOptions({ ...textOptions, fontFamily: e.target.value });
                updateElement(selectedElement, { fontFamily: e.target.value });
              }}
              className="p-1 border rounded"
            >
              <option value="Arial">Arial</option>
              <option value="Times New Roman">Times New Roman</option>
              <option value="Courier New">Courier New</option>
            </select>

            <select
              value={textOptions.fontSize}
              onChange={(e) => {
                setTextOptions({
                  ...textOptions,
                  fontSize: parseInt(e.target.value),
                });
                updateElement(selectedElement, {
                  fontSize: parseInt(e.target.value),
                });
              }}
              className="p-1 border rounded w-16"
            >
              {[8, 10, 12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72].map(
                (size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                )
              )}
            </select>

            <button
              onClick={() => {
                const newBold = !textOptions.bold;
                setTextOptions({ ...textOptions, bold: newBold });
                updateElement(selectedElement, { bold: newBold });
              }}
              className={`p-1 border rounded ${
                textOptions.bold ? "bg-gray-400" : "bg-white"
              }`}
            >
              <Bold size={16} />
            </button>

            <button
              onClick={() => {
                const newItalic = !textOptions.italic;
                setTextOptions({ ...textOptions, italic: newItalic });
                updateElement(selectedElement, { italic: newItalic });
              }}
              className={`p-1 border rounded ${
                textOptions.italic ? "bg-gray-400" : "bg-white"
              }`}
            >
              <Italic size={16} />
            </button>

            <div className="flex border rounded">
              <button
                onClick={() => {
                  setTextOptions({ ...textOptions, align: "left" });
                  updateElement(selectedElement, { align: "left" });
                }}
                className={`p-1 ${
                  textOptions.align === "left" ? "bg-gray-400" : "bg-white"
                }`}
              >
                <AlignLeft size={16} />
              </button>
              <button
                onClick={() => {
                  setTextOptions({ ...textOptions, align: "center" });
                  updateElement(selectedElement, { align: "center" });
                }}
                className={`p-1 ${
                  textOptions.align === "center" ? "bg-gray-400" : "bg-white"
                }`}
              >
                <AlignCenter size={16} />
              </button>
              <button
                onClick={() => {
                  setTextOptions({ ...textOptions, align: "right" });
                  updateElement(selectedElement, { align: "right" });
                }}
                className={`p-1 ${
                  textOptions.align === "right" ? "bg-gray-400" : "bg-white"
                }`}
              >
                <AlignRight size={16} />
              </button>
            </div>
          </div>
        )}

      {/* Main Editor Area */}
      <div className="flex-1 flex justify-center p-4 overflow-auto bg-gray-200">
        <div
          ref={canvasRef}
          className="bg-white shadow-lg"
          style={{
            width: `${canvasSize.width}px`,
            height: `${canvasSize.height}px`,
            position: "relative",
          }}
          onMouseDown={handleCanvasMouseDown}
        >
          {/* Render all elements */}
          {elements.map((element) => {
            const isSelected = element.id === selectedElement;

            9999;
            if (element.type === "text") {
              return (
                <div
                  key={element.id}
                  className={`absolute cursor-move ${
                    isSelected ? "outline  outline-blue-500" : ""
                  }`}
                  style={{
                    left: `${element.x}px`,
                    top: `${element.y}px`,
                    maxWidth: "80%",
                    textAlign: element.align || "left",
                  }}
                  onMouseDown={(e) => handleElementMouseDown(e, element.id)}
                >
                  {isSelected ? (
                    <textarea
                      ref={(el) => {
                        if (el) {
                          el.style.height = "auto"; // Reset height
                          el.style.height = el.scrollHeight + "px"; // Expand height
                          el.style.width = "auto"; // Optional: Reset width
                          el.style.width = el.scrollWidth + "px"; // Optional: Expand width
                        }
                      }}
                      value={element.content}
                      onChange={(e) =>
                        handleTextChange(element.id, e.target.value)
                      }
                      placeholder={element.placeholder}
                      style={{
                        fontFamily: element.fontFamily || "Arial",
                        fontSize: `${element.fontSize || 16}px`,
                        fontWeight: element.bold ? "bold" : "normal",
                        fontStyle: element.italic ? "italic" : "normal",
                        background: "transparent",
                        resize: "both",
                        overflow: "hidden", // Hide scrollbars
                        outline: "none",
                        border: "1px solid transparent",
                        minWidth: "100px",
                        minHeight: "30px",
                        maxWidth: `${canvasSize.width - element.x}px`,
                        maxHeight: `${canvasSize.height - element.y}px`,
                        color: "black",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div
                      style={{
                        fontFamily: element.fontFamily || "Arial",
                        fontSize: `${element.fontSize || 16}px`,
                        fontWeight: element.bold ? "bold" : "normal",
                        fontStyle: element.italic ? "italic" : "normal",
                      }}
                    >
                      {element.content}
                    </div>
                  )}
                </div>
              );
            } else if (element.type === "image") {
              return (
                <Rnd
                  key={element.id}
                  size={{ width: element.width, height: element.height }}
                  position={{ x: element.x, y: element.y }}
                  onDragStop={(e, d) => {
                    updateElement(element.id, { x: d.x, y: d.y });
                  }}
                  onResizeStop={(e, direction, ref, delta, position) => {
                    updateElement(element.id, {
                      width: parseInt(ref.style.width),
                      height: parseInt(ref.style.height),
                      x: position.x,
                      y: position.y,
                    });
                  }}
                  bounds="parent"
                  onClick={() => {
                    setSelectedElement(element.id);
                    setUploadingImageId(element.id);
                    imageUploadRef.current.click();
                  }}
                  style={{
                    border: isSelected ? "2px solid #3b82f6" : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#f3f4f6",
                    cursor: "move",
                  }}
                    >
                  {element.src && element.src.startsWith("data:image") ? (
                    <img
                      src={element.src}
                      alt="Uploaded"
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        pointerEvents: "none",
                      }}
                    />
                  ) : (
                    <button
                      className="text-sm text-blue-600 hover:text-blue-800"
                      onClick={(e) => {
                        e.stopPropagation(); // prevent deselect
                        setUploadingImageId(element.id);
                        imageUploadRef.current.click();
                      }}
                    >
                      Click to add image
                    </button>
                  )}
                </Rnd>
              );
            }
            return null;
          })}
        </div>
      </div>
    </div>
  );
}
