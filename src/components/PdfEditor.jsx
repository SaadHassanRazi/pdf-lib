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
  ChevronLeft,
  ChevronRight,
  Upload,
  Replace,
  Highlighter,
} from "lucide-react";
import * as _ from "lodash";
import { Rnd } from "react-rnd";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import * as pdfjsLib from "pdfjs-dist/build/pdf";

// Set pdf.js worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

export default function PDFEditor() {
  const imageUploadRef = useRef(null);
  const pdfUploadRef = useRef(null);
  const textareaRef = useRef(null);
  const [uploadingImageId, setUploadingImageId] = useState(null);
  const [pages, setPages] = useState([[]]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedElement, setSelectedElement] = useState(null);
  const [canvasSize, setCanvasSize] = useState({ width: 595, height: 842 });
  const canvasRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [textOptions, setTextOptions] = useState({
    fontSize: 16,
    fontFamily: "Arial",
    bold: false,
    italic: false,
    align: "left",
    highlight: false,
  });
  const [isImportingPDF, setIsImportingPDF] = useState(false);
  const [showTextToolbar, setShowTextToolbar] = useState(false);
  const [pdfDocument, setPdfDocument] = useState(null);
  const [importProgress, setImportProgress] = useState(0);
  const [textRegions, setTextRegions] = useState({});
  const [isEditing, setIsEditing] = useState(false); // State to track editing mode
  const [editingContent, setEditingContent] = useState(""); // New state to track current editing content
  const backgroundUpdateTimeout = useRef(null); // For debouncing

  // Sanitize text to remove invisible characters
  const sanitizeText = (text) => {
    return text.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim();
  };

  // Add text element (manual)
  const addTextElement = () => {
    const newElement = {
      id: Date.now(),
      type: "text",
      content: "Enter your text here...",
      x: 100,
      y: 100,
      fontSize: textOptions.fontSize,
      fontFamily: textOptions.fontFamily,
      bold: textOptions.bold,
      italic: textOptions.italic,
      align: textOptions.align,
      highlight: textOptions.highlight,
    };

    setPages((prevPages) => {
      const updatedPages = [...prevPages];
      updatedPages[currentPage] = [...updatedPages[currentPage], newElement];
      return updatedPages;
    });

    setSelectedElement(newElement.id);
    setEditingContent(newElement.content);
    setShowTextToolbar(true);
    setIsEditing(true);

    // Give time for the textarea to be rendered before focusing
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }, 100);
  };

  // Add new page
  const addNewPage = () => {
    setPages((prev) => {
      const updated = [...prev, []];
      setCurrentPage(updated.length - 1);
      return updated;
    });
  };

  // Add image element
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

  // Update background image to mask text
  const updateBackgroundImage = async (pageNum, regionsToMask = []) => {
    if (!pdfDocument) return null;
    try {
      const page = await pdfDocument.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });

      const canvasWidth = canvasSize.width;
      const scaleFactor = canvasWidth / viewport.width;
      const canvasHeight = viewport.height * scaleFactor;

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      await page.render({
        canvasContext: context,
        viewport: page.getViewport({ scale: scaleFactor }),
      }).promise;

      // Mask text regions with slight padding
      regionsToMask.forEach((region) => {
        context.fillStyle = "white";
        context.fillRect(
          region.x * scaleFactor - 2,
          region.y * scaleFactor - 2,
          region.width * scaleFactor + 4,
          region.height * scaleFactor + 4
        );
      });

      const imgData = canvas.toDataURL("image/png");
      return { imgData, width: canvasWidth, height: canvasHeight };
    } catch (error) {
      console.error("Error updating background:", error);
      return null;
    }
  };

  // Handle PDF import
  const handlePDFUpload = async (e) => {
    const file = e.target.files[0];
    if (file && file.type === "application/pdf") {
      setIsImportingPDF(true);
      setImportProgress(0);
      try {
        const reader = new FileReader();
        reader.onload = async (event) => {
          const typedArray = new Uint8Array(event.target.result);

          try {
            const pdf = await pdfjsLib.getDocument(typedArray).promise;
            setPdfDocument(pdf);
            const numPages = pdf.numPages;
            const newPages = [];

            for (let pageNum = 1; pageNum <= numPages; pageNum++) {
              const page = await pdf.getPage(pageNum);
              const viewport = page.getViewport({ scale: 1 });

              const canvasWidth = 595;
              const scaleFactor = canvasWidth / viewport.width;
              const canvasHeight = Math.round(viewport.height * scaleFactor);

              if (pageNum === 1) {
                setCanvasSize({ width: canvasWidth, height: canvasHeight });
              }

              const canvas = document.createElement("canvas");
              const context = canvas.getContext("2d");
              canvas.width = canvasWidth;
              canvas.height = canvasHeight;

              await page.render({
                canvasContext: context,
                viewport: page.getViewport({ scale: scaleFactor }),
              }).promise;

              const imgData = canvas.toDataURL("image/png");

              const backgroundElement = {
                id: Date.now() + pageNum,
                type: "image",
                src: imgData,
                x: 0,
                y: 0,
                width: canvasWidth,
                height: canvasHeight,
                isBackground: true,
              };

              newPages.push([backgroundElement]);
              setImportProgress((pageNum / numPages) * 100);
            }

            setPages(newPages);
            setCurrentPage(0);
            setIsImportingPDF(false);
            setImportProgress(100);
          } catch (pdfError) {
            console.error("PDF processing error:", pdfError);
            alert(
              "Error processing the PDF. The file might be corrupted or password-protected."
            );
            setIsImportingPDF(false);
            setImportProgress(0);
          }
        };

        reader.onerror = () => {
          alert("Error reading the file. Please try again.");
          setIsImportingPDF(false);
          setImportProgress(0);
        };

        reader.readAsArrayBuffer(file);
      } catch (error) {
        console.error("Error importing PDF:", error);
        alert("Failed to import PDF. Please ensure the file is valid.");
        setIsImportingPDF(false);
        setImportProgress(0);
      }
    } else {
      alert("Please upload a valid PDF file.");
      setIsImportingPDF(false);
    }
  };

  // Handle image upload
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file && uploadingImageId) {
      const reader = new FileReader();
      reader.onload = (event) => {
        updateElement(uploadingImageId, { src: event.target.result });
        setUploadingImageId(null);
      };
      reader.readAsDataURL(file);
    }
  };

  // Update element
  const updateElement = (id, updates) => {
    const updatedPages = [...pages];
    updatedPages[currentPage] = updatedPages[currentPage].map((el) =>
      el.id === id ? { ...el, ...updates } : el
    );
    setPages(updatedPages);

    // Debounce background update
    if (updates.content && updates.textRegion) {
      const region = updates.textRegion;
      setTextRegions((prev) => {
        const pageRegions = prev[currentPage] || [];
        const updatedRegions = pageRegions.filter((r) => r.id !== id);
        updatedRegions.push({ id, ...region });
        return { ...prev, [currentPage]: updatedRegions };
      });

      if (backgroundUpdateTimeout.current) {
        clearTimeout(backgroundUpdateTimeout.current);
      }
      backgroundUpdateTimeout.current = setTimeout(() => {
        updateBackgroundImage(currentPage + 1, [{ id, ...region }]).then(
          (result) => {
            if (result) {
              const backgroundElement = pages[currentPage].find(
                (el) => el.isBackground
              );
              if (backgroundElement) {
                updateElement(backgroundElement.id, {
                  src: result.imgData,
                  width: result.width,
                  height: result.height,
                });
              }
            }
          }
        );
      }, 500); // 500ms debounce
    }
  };

  // Delete element
  const deleteElement = () => {
    if (!selectedElement) return;

    const updatedPages = [...pages];
    const deletedElement = updatedPages[currentPage].find(
      (el) => el.id === selectedElement
    );

    if (!deletedElement) return;

    // Don't allow deletion of background elements
    if (deletedElement.isBackground) return;

    updatedPages[currentPage] = updatedPages[currentPage].filter(
      (el) => el.id !== selectedElement
    );
    setPages(updatedPages);
    setSelectedElement(null);
    setShowTextToolbar(false);
    setIsEditing(false);
    setEditingContent("");

    if (deletedElement?.textRegion) {
      setTextRegions((prev) => {
        const pageRegions = prev[currentPage] || [];
        const updatedRegions = pageRegions.filter(
          (r) => r.id !== deletedElement.id
        );
        return { ...prev, [currentPage]: updatedRegions };
      });

      // Update background to remove the masked area
      updateBackgroundImage(currentPage + 1, []).then((result) => {
        if (result) {
          const backgroundElement = updatedPages[currentPage].find(
            (el) => el.isBackground
          );
          if (backgroundElement) {
            updateElement(backgroundElement.id, {
              src: result.imgData,
              width: result.width,
              height: result.height,
            });
          }
        }
      });
    }
  };

  // Handle mousedown on element
  const handleElementMouseDown = (e, id) => {
    e.stopPropagation();

    // Check if we're already editing this element
    if (isEditing && id === selectedElement) {
      return; // Allow editing to continue
    }

    setSelectedElement(id);
    const element = pages[currentPage].find((el) => el.id === id);

    if (element.type === "text") {
      setShowTextToolbar(true);
      setTextOptions({
        fontSize: element.fontSize,
        fontFamily: element.fontFamily,
        bold: element.bold,
        italic: element.italic,
        align: element.align,
        highlight: element.highlight,
      });
      setEditingContent(element.content);

      // Double-click to edit text
      if (e.detail === 2) {
        setIsEditing(true);
        return; // Skip dragging if double-clicked for editing
      }
    } else {
      setShowTextToolbar(false);
    }

    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  // Handle canvas mousedown (click-to-edit text)
  const handleCanvasMouseDown = async (e) => {
    // Close active editing if clicking on canvas
    if (isEditing) {
      setIsEditing(false);
    }

    setSelectedElement(null);
    setShowTextToolbar(false);

    if (!pdfDocument || isImportingPDF) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    setIsImportingPDF(true);
    try {
      const page = await pdfDocument.getPage(currentPage + 1);
      const viewport = page.getViewport({ scale: 1.0 });
      const textContent = await page.getTextContent();

      let closestItem = null;
      let minDistance = Infinity;

      // Process text items to find the closest one to the click
      textContent.items.forEach((item) => {
        if (!item.str.trim()) return;

        const x = item.transform[4] || 0;
        const y =
          viewport.height - (item.transform[5] || 0) - (item.height || 0);
        const width = item.width || 100;
        const height = item.height || 16;

        const scaleFactor = canvasSize.width / viewport.width;
        const canvasX = x * scaleFactor;
        const canvasY = y * scaleFactor;

        // Calculate center of text element
        const centerX = canvasX + (width * scaleFactor) / 2;
        const centerY = canvasY + (height * scaleFactor) / 2;

        // Calculate distance from click to center of text
        const distance = Math.sqrt(
          Math.pow(clickX - centerX, 2) + Math.pow(clickY - centerY, 2)
        );

        // Find the closest text element
        if (distance < minDistance) {
          minDistance = distance;
          closestItem = { ...item, x, y, width, height };
        }
      });

      // If we found text close to the click (within 50px)
      if (closestItem && minDistance < 50) {
        const x = closestItem.x;
        const y = closestItem.y;
        const width = closestItem.width || 100;
        const height = closestItem.height || 16;

        const scaleFactor = canvasSize.width / viewport.width;
        const sanitizedContent = sanitizeText(closestItem.str);

        // Check if this text exists in the currently added elements
        const existingElement = pages[currentPage].find(
          (el) =>
            el.type === "text" &&
            Math.abs(el.x - x * scaleFactor) < 10 &&
            Math.abs(el.y - y * scaleFactor) < 10
        );

        if (existingElement) {
          // Select existing element instead of creating duplicate
          setSelectedElement(existingElement.id);
          setEditingContent(existingElement.content);
          setIsEditing(true);
          setShowTextToolbar(true);
          setTextOptions({
            fontSize: existingElement.fontSize,
            fontFamily: existingElement.fontFamily,
            bold: existingElement.bold,
            italic: existingElement.italic,
            align: existingElement.align,
            highlight: existingElement.highlight,
          });
        } else {
          // Create new text element
          const newElement = {
            id: Date.now(),
            type: "text",
            content: sanitizedContent,
            x: x * scaleFactor,
            y: y * scaleFactor,
            fontSize: Math.max(12, Math.round(closestItem.height * 0.8)) || 16,
            fontFamily: "Arial",
            bold: closestItem.fontName?.includes("Bold") || false,
            italic: closestItem.fontName?.includes("Italic") || false,
            align: "left",
            highlight: false,
            textRegion: { x, y, width, height },
          };

          // Register text region for masking
          setTextRegions((prev) => {
            const pageRegions = prev[currentPage] || [];
            return {
              ...prev,
              [currentPage]: [
                ...pageRegions,
                { id: newElement.id, x, y, width, height },
              ],
            };
          });

          // Update background image to mask the original text
          const backgroundUpdate = await updateBackgroundImage(
            currentPage + 1,
            [{ id: newElement.id, x, y, width, height }]
          );

          if (backgroundUpdate) {
            const backgroundElement = pages[currentPage].find(
              (el) => el.isBackground
            );
            if (backgroundElement) {
              updateElement(backgroundElement.id, {
                src: backgroundUpdate.imgData,
                width: backgroundUpdate.width,
                height: backgroundUpdate.height,
              });
            }
          }

          // Add new text element to page
          setPages((prev) => {
            const updated = [...prev];
            updated[currentPage] = [...updated[currentPage], newElement];
            return updated;
          });

          // Select and prepare for editing
          setSelectedElement(newElement.id);
          setEditingContent(newElement.content);
          setShowTextToolbar(true);
          setIsEditing(true);
          setTextOptions({
            fontSize: newElement.fontSize,
            fontFamily: newElement.fontFamily,
            bold: newElement.bold,
            italic: newElement.italic,
            align: newElement.align,
            highlight: newElement.highlight,
          });
        }
      }
    } catch (error) {
      console.error("Error detecting text:", error);
      alert(
        "Failed to detect text at this location. Try adding text manually."
      );
    } finally {
      setIsImportingPDF(false);
    }
  };

  // Handle text content change
  const handleTextChange = (e) => {
    const newContent = e.target.value;
    setEditingContent(newContent);

    // Update the element with new content
    if (selectedElement) {
      const element = pages[currentPage].find(
        (el) => el.id === selectedElement
      );
      if (element) {
        updateElement(selectedElement, {
          content: newContent,
        });
      }
    }
  };

  // Handle editing completion
  const completeTextEditing = () => {
    if (selectedElement) {
      // Ensure final content is updated before exiting edit mode
      const element = pages[currentPage].find(
        (el) => el.id === selectedElement
      );
      if (element) {
        updateElement(selectedElement, {
          content: editingContent,
          textRegion: element.textRegion,
        });
      }
    }
    setIsEditing(false);
  };

  // Handle dragging
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging && selectedElement && !isEditing) {
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
  }, [isDragging, dragStart, selectedElement, pages, currentPage, isEditing]);

  // Update editingContent when selected element changes
  useEffect(() => {
    if (selectedElement) {
      const element = pages[currentPage].find(
        (el) => el.id === selectedElement
      );
      if (element && element.type === "text") {
        setEditingContent(element.content);
      }
    }
  }, [selectedElement, pages, currentPage]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Handle Delete or Backspace key to delete selected element
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedElement &&
        !isEditing
      ) {
        deleteElement();
      }

      // Handle Escape key to cancel editing
      if (e.key === "Escape" && isEditing) {
        setIsEditing(false);
      }

      // Handle Enter key to finish editing when holding Ctrl/Cmd
      if (e.key === "Enter" && isEditing && (e.ctrlKey || e.metaKey)) {
        completeTextEditing();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedElement, isEditing]);

  // Focus text area when editing starts
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          // Move cursor to end of text
          textareaRef.current.selectionStart = textareaRef.current.value.length;
          textareaRef.current.selectionEnd = textareaRef.current.value.length;
        }
      }, 50);
    }
  }, [isEditing, selectedElement]);

  // Export to PDF
  const exportToPDF = async () => {
    setIsExporting(true);
    try {
      // Temporarily hide any editing UI
      const wasEditing = isEditing;
      setIsEditing(false);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [canvasSize.width, canvasSize.height],
      });

      const originalPage = currentPage;

      for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
        setCurrentPage(pageIndex);
        // Give the UI time to update
        await new Promise((resolve) => setTimeout(resolve, 100));

        const canvas = canvasRef.current;
        if (!canvas) {
          console.error(`Canvas not found for page ${pageIndex + 1}`);
          continue;
        }

        try {
          const canvasImage = await html2canvas(canvas, {
            scale: 2,
            useCORS: true,
            logging: false,
            allowTaint: true,
          });

          const imgData = canvasImage.toDataURL("image/png");

          if (pageIndex > 0) {
            pdf.addPage();
          }
          pdf.addImage(
            imgData,
            "PNG",
            0,
            0,
            canvasSize.width,
            canvasSize.height
          );
        } catch (pageError) {
          console.error(`Error rendering page ${pageIndex + 1}:`, pageError);
        }
      }

      // Restore page and editing state
      setCurrentPage(originalPage);
      if (wasEditing) {
        setTimeout(() => setIsEditing(true), 100);
      }

      pdf.save("document.pdf");
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("Error generating PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Toolbar */}
      <div className="bg-white shadow p-4 flex items-center space-x-4">
        <h1 className="text-xl font-bold flex-1">PDF Editor</h1>

        <div className="flex items-center space-x-2">
          <button
            onClick={addTextElement}
            className="p-2 bg-blue-500 text-white rounded flex items-center"
            disabled={isImportingPDF || isExporting}
          >
            <Type size={16} className="mr-1" /> Add Text
          </button>
          <button
            onClick={addImageElement}
            className="p-2 bg-green-500 text-white rounded flex items-center"
            disabled={isImportingPDF || isExporting}
          >
            <Image size={16} className="mr-1" /> Add Image
          </button>
          <button
            onClick={() => pdfUploadRef.current.click()}
            className="p-2 bg-yellow-500 text-white rounded flex items-center"
            disabled={isImportingPDF || isExporting}
          >
            <Upload size={16} className="mr-1" />
            {isImportingPDF
              ? `Importing... (${Math.round(importProgress)}%)`
              : "Import PDF"}
          </button>
          {selectedElement && (
            <button
              onClick={deleteElement}
              className="p-2 bg-red-500 text-white rounded flex items-center"
              disabled={isImportingPDF || isExporting}
            >
              <Trash2 size={16} className="mr-1" /> Delete
            </button>
          )}
        </div>
        <div className="flex items-center justify-between p-2">
          <button
            onClick={addNewPage}
            className="p-2 bg-blue-500 text-white rounded"
            disabled={isImportingPDF || isExporting}
          >
            Add Page
          </button>
          <button
            onClick={() => setCurrentPage(Math.max(currentPage - 1, 0))}
            disabled={currentPage === 0 || isImportingPDF || isExporting}
            className="p-2 bg-gray-300 m-3 rounded disabled:opacity-50"
          >
            <ChevronLeft size={16} className="mr-1" />
          </button>
          <span>
            Page {currentPage + 1} of {pages.length}
          </span>
          <button
            onClick={() =>
              setCurrentPage(Math.min(currentPage + 1, pages.length - 1))
            }
            disabled={
              currentPage === pages.length - 1 || isImportingPDF || isExporting
            }
            className="p-2 bg-gray-300 rounded disabled:opacity-50 m-2"
          >
            <ChevronRight size={16} className="ml-1" />
          </button>
        </div>

        <button
          onClick={exportToPDF}
          disabled={isExporting || isImportingPDF}
          className={`p-2 bg-purple-600 text-white rounded flex items-center ${
            isExporting || isImportingPDF ? "opacity-50" : ""
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
      <input
        type="file"
        accept="application/pdf"
        ref={pdfUploadRef}
        style={{ display: "none" }}
        onChange={handlePDFUpload}
      />

      {/* Text Formatting Toolbar */}
      {showTextToolbar && (
        <div className="bg-gray-200 p-2 flex items-center space-x-4">
          <select
            value={textOptions.fontFamily}
            onChange={(e) => {
              const newFontFamily = e.target.value;
              setTextOptions({ ...textOptions, fontFamily: newFontFamily });
              if (selectedElement) {
                updateElement(selectedElement, { fontFamily: newFontFamily });
              }
            }}
            className="p-1 border rounded"
            disabled={isImportingPDF || isExporting}
          >
            <option value="Arial">Arial</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Courier New">Courier New</option>
          </select>

          <select
            value={textOptions.fontSize}
            onChange={(e) => {
              const newFontSize = parseInt(e.target.value);
              setTextOptions({ ...textOptions, fontSize: newFontSize });
              if (selectedElement) {
                updateElement(selectedElement, { fontSize: newFontSize });
              }
            }}
            className="p-1 border rounded w-16"
            disabled={isImportingPDF || isExporting}
          >
            {[8, 10, 12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              const newBold = !textOptions.bold;
              setTextOptions({ ...textOptions, bold: newBold });
              if (selectedElement) {
                updateElement(selectedElement, { bold: newBold });
              }
            }}
            className={`p-1 border rounded ${
              textOptions.bold ? "bg-gray-400" : "bg-white"
            }`}
            disabled={isImportingPDF || isExporting}
          >
            <Bold size={16} />
          </button>

          <button
            onClick={() => {
              const newItalic = !textOptions.italic;
              setTextOptions({ ...textOptions, italic: newItalic });
              if (selectedElement) {
                updateElement(selectedElement, { italic: newItalic });
              }
            }}
            className={`p-1 border rounded ${
              textOptions.italic ? "bg-gray-400" : "bg-white"
            }`}
            disabled={isImportingPDF || isExporting}
          >
            <Italic size={16} />
          </button>

          <button
            onClick={() => {
              const newHighlight = !textOptions.highlight;
              setTextOptions({ ...textOptions, highlight: newHighlight });
              if (selectedElement) {
                updateElement(selectedElement, { highlight: newHighlight });
              }
            }}
            className={`p-1 border rounded ${
              textOptions.highlight ? "bg-yellow-300" : "bg-white"
            }`}
            disabled={isImportingPDF || isExporting}
          >
            <Highlighter size={16} />
          </button>

          <div className="flex border rounded">
            <button
              onClick={() => {
                setTextOptions({ ...textOptions, align: "left" });

                if (selectedElement) {
                  updateElement(selectedElement, { align: "left" });
                }
              }}
              className={`p-1 ${
                textOptions.align === "left" ? "bg-gray-400" : "bg-white"
              }`}
              disabled={isImportingPDF}
            >
              <AlignLeft size={16} />
            </button>
            <button
              onClick={() => {
                setTextOptions({ ...textOptions, align: "center" });
                if (selectedElement) {
                  updateElement(selectedElement, { align: "center" });
                }
              }}
              className={`p-1 ${
                textOptions.align === "center" ? "bg-gray-400" : "bg-white"
              }`}
              disabled={isImportingPDF}
            >
              <AlignCenter size={16} />
            </button>
            <button
              onClick={() => {
                setTextOptions({ ...textOptions, align: "right" });
                if (selectedElement) {
                  updateElement(selectedElement, { align: "right" });
                }
              }}
              className={`p-1 ${
                textOptions.align === "right" ? "bg-gray-400" : "bg-white"
              }`}
              disabled={isImportingPDF}
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
                    backgroundColor: element.highlight
                      ? "#ffff99"
                      : "transparent",
                  }}
                  onMouseDown={(e) => handleElementMouseDown(e, element.id)}
                >
                  {isSelected && isEditing ? (
                    <textarea
                      ref={textareaRef}
                      value={editingContent}
                      onChange={handleTextChange}
                      className="w-full min-w-[100px]"
                      style={{
                        fontFamily: element.fontFamily || "Arial",
                        fontSize: `${element.fontSize || 16}px`,
                        fontWeight: element.bold ? "bold" : "normal",
                        fontStyle: element.italic ? "italic" : "normal",
                        backgroundColor: element.highlight
                          ? "#ffff99"
                          : "transparent",
                        resize: "both",
                        overflow: "hidden",
                        outline: "none",
                        border: "1px solid transparent",
                        minHeight: "30px",
                        maxWidth: `${canvasSize.width - element.x}px`,
                        maxHeight: `${canvasSize.height - element.y}px`,
                        color: "black",
                      }}
                      onClick={(e) => e.stopPropagation()}
                      disabled={isImportingPDF}
                    />
                  ) : (
                    <div
                      style={{
                        fontFamily: element.fontFamily || "Arial",
                        fontSize: `${element.fontSize || 16}px`,
                        fontWeight: element.bold ? "bold" : "normal",
                        fontStyle: element.italic ? "italic" : "normal",
                        backgroundColor: element.highlight
                          ? "#ffff99"
                          : "transparent",
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
                  enableResizing={!element.isBackground}
                  enableDragging={!element.isBackground}
                  onClick={() => {
                    if (!element.isBackground) {
                      setSelectedElement(element.id);
                    }
                  }}
                  style={{
                    border: isSelected ? "2px solid #3b82f6" : "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: element.isBackground ? "none" : "#f3f4f6",
                    cursor: element.isBackground ? "default" : "move",
                    zIndex: element.isBackground ? 0 : 1,
                  }}
                >
                  {element.src && element.src.startsWith("data:image") ? (
                    <>
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
                      {!element.isBackground && isSelected && (
                        <button
                          className="absolute top-2 right-2 p-1 bg-blue-500 text-white rounded flex items-center text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setUploadingImageId(element.id);
                            imageUploadRef.current.click();
                          }}
                          disabled={isImportingPDF}
                        >
                          <Replace size={12} className="mr-1" />
                          Replace
                        </button>
                      )}
                    </>
                  ) : (
                    !element.isBackground && (
                      <button
                        className="text-sm text-blue-600 hover:text-blue-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadingImageId(element.id);
                          imageUploadRef.current.click();
                        }}
                        disabled={isImportingPDF}
                      >
                        Click to add image
                      </button>
                    )
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
