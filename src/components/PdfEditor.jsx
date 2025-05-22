import React, { useState, useRef, useEffect } from "react";
import {
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
} from "lucide-react";
import * as _ from "lodash";
import { Rnd } from "react-rnd";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// PDF Editor Component
export default function PDFEditor() {
  const imageUploadRef = useRef(null);
  const [uploadingImageId, setUploadingImageId] = useState(null);
  const [pages, setPages] = useState([[]]); // Page 0 starts with empty array of elements
  const [currentPage, setCurrentPage] = useState(0);
  const [isExporting, setIsExporting] = useState(false); // New state for loading indicator

  // State for managing PDF content
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
    const newElement = {
      id: Date.now(),
      type: "text",
      content: "Edit this text",
      x: 100,
      y: 100,
      ...textOptions,
    };

    setPages((prev) => {
      const updated = [...prev];
      updated[currentPage] = [...updated[currentPage], newElement];
      return updated;
    });
  };

  const addNewPage = () => {
    setPages((prev) => {
      const updated = [...prev, []];
      setCurrentPage(updated.length - 1); // correct index after update
      return updated;
    });
  };

  // Function to add an image element
  const addImageElement = () => {
    const newElement = {
      id: Date.now(),
      type: "image",
      src: "null",
      x: 100,
      y: 100,
      width: 200,
      height: 150,
    };
    setPages((prev) => {
      const updated = [...prev];
      updated[currentPage] = [...updated[currentPage], newElement];
      return updated;
    });
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
    const updatedPages = [...pages];
    updatedPages[currentPage] = updatedPages[currentPage].map((el) =>
      el.id === id ? { ...el, ...updates } : el
    );
    setPages(updatedPages);
  };

  // Function to delete the selected element
  const deleteElement = () => {
    const updatedPages = [...pages];
    updatedPages[currentPage] = updatedPages[currentPage].filter(
      (el) => el.id !== selectedElement
    );
    setPages(updatedPages);
    setSelectedElement(null);
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

        const currentElements = pages[currentPage] || [];
        const element = currentElements.find((el) => el.id === selectedElement);

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
  }, [isDragging, dragStart, selectedElement]);

  // Handle export to PDF
  const exportToPDF = async () => {
    setIsExporting(true);
    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [canvasSize.width, canvasSize.height],
      });

      // Store the original page to restore it later
      const originalPage = currentPage;

      // Iterate through all pages
      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        // Switch to the current page to render its content
        setCurrentPage(pageIndex);

        // Wait for the UI to update (React may need a tick to re-render)
        await new Promise((resolve) => setTimeout(resolve, 100));

        const canvas = canvasRef.current;
        if (!canvas) {
          console.error(`Canvas not found for page ${pageIndex + 1}`);
          continue;
        }

        // Capture the canvas as an image
        const canvasImage = await html2canvas(canvas, {
          scale: 2, // Increase resolution for better quality
          useCORS: true, // Handle cross-origin images if any
        });
        const imgData = canvasImage.toDataURL("image/png");

        // Add the image to the PDF
        if (pageIndex > 0) {
          pdf.addPage();
        }
        pdf.addImage(imgData, "PNG", 0, 0, canvasSize.width, canvasSize.height);
      }

      // Restore the original page
      setCurrentPage(originalPage);

      // Save the PDF
      pdf.save("document.pdf");
    } catch (err) {
      console.error("PDF generation error:", err);
    } finally {
      setIsExporting(false);
    }
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
        <div className="flex items-center justify-between p-2 bg-white shadow">
          <button
            onClick={() => setCurrentPage(Math.max(currentPage - 1, 0))}
            disabled={currentPage === 0}
            className="p-2 bg-gray-300 rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span>
            Page {currentPage + 1} of {pages.length}
          </span>
          <button
            onClick={() =>
              setCurrentPage(Math.min(currentPage + 1, pages.length - 1))
            }
            disabled={currentPage === pages.length - 1}
            className="p-2 bg-gray-300 rounded disabled:opacity-50"
          >
            Next
          </button>
          <button
            onClick={addNewPage}
            className="p-2 bg-blue-500 text-white rounded"
          >
            Add Page
          </button>
        </div>

        {/* Export */}
        <button
          onClick={exportToPDF}
          disabled={isExporting}
          className={`p-2 bg-purple-600 text-white rounded flex items-center ${
            isExporting ? "opacity-50" : ""
          }`}
        >
          <Download size={16} className="mr-1" />
          {isExporting ? "Exporting..." : "Export PDF"}
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
        pages[currentPage].find((el) => el.id === selectedElement)?.type ===
          "text" && (
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
          {pages[currentPage].map((element) => {
            const isSelected = element.id === selectedElement;

            if (element.type === "text") {
              return (
                <div
                  key={element.id}
                  className={`absolute cursor-move ${
                    isSelected ? "outline outline-blue-500" : ""
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
                          el.style.width = "auto"; // Reset width
                          el.style.width = el.scrollWidth + "px"; // Expand width
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
